import { ArraySchema } from "@colyseus/schema";
import { GameState, Player, BoardSpace, TradeOffer, AuctionState, BankruptcyNegotiation } from "../state/GameState.js";
import {
  BOARD_SPACES,
  TOTAL_SPACES,
  INCOME_TAX,
  LUXURY_TAX,
  SUPER_TAX,
  PAYDAY_BONUS,
  MAX_ROUNDS,
  HOUSE_COST,
  HOTEL_COST,
  DISTRICT_PROPERTIES,
  MAX_HOUSES,
  JAIL_FINE,
  JAIL_SPACE_INDEX,
  MAX_JAIL_TURNS,
} from "./boardConfig.js";
import {
  CardDefinition,
  COMMUNITY_CARDS,
  CHANCE_CARDS,
  getCardById,
} from "./cardData.js";

/**
 * Initialize the board spaces in the game state from config.
 */
export function initializeBoard(state: GameState): void {
  for (const config of BOARD_SPACES) {
    const space = new BoardSpace();
    space.index = config.index;
    space.name = config.name;
    space.spaceType = config.spaceType;
    space.district = config.district;
    space.price = config.price;
    space.rent = config.rent;
    space.ownerId = "";
    state.boardSpaces.push(space);
  }
}

/**
 * Roll two six-sided dice. Returns [die1, die2].
 */
export function rollDice(): [number, number] {
  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  return [d1, d2];
}

/**
 * Get the current player whose turn it is.
 */
export function getCurrentPlayer(state: GameState): Player | null {
  const activePlayers = getActivePlayers(state);
  if (activePlayers.length === 0) return null;
  const idx = state.currentPlayerIndex % activePlayers.length;
  return activePlayers[idx];
}

/**
 * Get all active (non-bankrupt) players in order.
 */
export function getActivePlayers(state: GameState): Player[] {
  const players: Player[] = [];
  state.players.forEach((player) => {
    if (player.isActive && !player.isBankrupt) {
      players.push(player);
    }
  });
  // Sort by playerIndex to maintain consistent turn order
  players.sort((a, b) => a.playerIndex - b.playerIndex);
  return players;
}

/**
 * Move a player forward by the given number of spaces.
 * Returns true if the player passed Payday.
 */
export function movePlayer(player: Player, spaces: number): boolean {
  const oldPosition = player.position;
  const newPosition = (oldPosition + spaces) % TOTAL_SPACES;
  player.position = newPosition;

  // Check if player passed or landed on Payday (index 0)
  return newPosition < oldPosition;
}

/**
 * Send a player to jail.
 */
export function sendToJail(player: Player): void {
  player.position = JAIL_SPACE_INDEX;
  player.inJail = true;
  player.jailTurnsRemaining = MAX_JAIL_TURNS;
}

/**
 * Release a player from jail.
 */
export function releaseFromJail(player: Player): void {
  player.inJail = false;
  player.jailTurnsRemaining = 0;
}

/**
 * Process what happens when a player lands on their current space.
 * Returns a description of what happened.
 */
export function processLanding(state: GameState, player: Player): string {
  const space = state.boardSpaces[player.position];

  switch (space.spaceType) {
    case "payday":
      // Landed directly on Payday - bonus already given when passing
      return `${player.displayName} is on Payday!`;

    case "property":
      return processPropertyLanding(state, player, space);

    case "tax":
      return processTaxLanding(state, player, space);

    case "jail":
      return `${player.displayName} is just visiting Jail.`;

    case "goToJail":
      sendToJail(player);
      return `${player.displayName} was sent to Jail!`;

    case "parking":
      return `${player.displayName} is at City Parking. Nothing happens.`;

    case "community":
    case "chance":
      // Card drawing is handled by the GameRoom (which owns the deck state).
      // Return a placeholder message; the room will override lastAction after drawing.
      return `${player.displayName} landed on ${space.name}!`;

    default:
      return `${player.displayName} landed on ${space.name}.`;
  }
}

/**
 * Get the effective rent for a property based on houses/hotel.
 */
function getEffectiveRent(state: GameState, space: BoardSpace): number {
  const config = BOARD_SPACES[space.index];
  const rentScale = config?.rentScale;

  if (space.hasHotel && rentScale) {
    return rentScale[5]; // hotel
  }
  if (space.houses > 0 && rentScale) {
    return rentScale[space.houses]; // 1-4 houses
  }

  // Base rent - double if owner has monopoly but no houses
  const baseRent = rentScale ? rentScale[0] : space.rent;
  if (space.ownerId && space.district) {
    if (playerHasMonopoly(state, space.ownerId, space.district)) {
      return baseRent * 2;
    }
  }
  return baseRent;
}

/**
 * Check if a player owns all properties in a district.
 */
export function playerHasMonopoly(state: GameState, sessionId: string, district: string): boolean {
  const indices = DISTRICT_PROPERTIES[district];
  if (!indices || indices.length === 0) return false;
  return indices.every((idx) => state.boardSpaces[idx]?.ownerId === sessionId);
}

/**
 * Get all districts where the player has a monopoly.
 */
export function getPlayerMonopolies(state: GameState, sessionId: string): string[] {
  const monopolies: string[] = [];
  for (const district of Object.keys(DISTRICT_PROPERTIES)) {
    if (playerHasMonopoly(state, sessionId, district)) {
      monopolies.push(district);
    }
  }
  return monopolies;
}

/**
 * Get properties where the player can build a house.
 * Rules: must have monopoly, even building (can't build on a property
 * unless all others in the district have at least as many houses),
 * max 4 houses before hotel, must afford it, and property must not be mortgaged.
 */
export function getBuildableProperties(state: GameState, player: Player): number[] {
  const monopolies = getPlayerMonopolies(state, player.sessionId);
  const buildable: number[] = [];

  for (const district of monopolies) {
    const indices = DISTRICT_PROPERTIES[district];
    const cost = HOUSE_COST[district] || 100;
    if (player.coins < cost) continue;

    // Check if any property in the district is mortgaged - can't build if so
    const anyMortgaged = indices.some((idx) => state.boardSpaces[idx]?.isMortgaged);
    if (anyMortgaged) continue;

    // Get current house counts
    const houseCounts = indices.map((idx) => {
      const s = state.boardSpaces[idx];
      return s.hasHotel ? 5 : s.houses;
    });
    const minHouses = Math.min(...houseCounts);

    for (let i = 0; i < indices.length; i++) {
      const space = state.boardSpaces[indices[i]];
      if (space.hasHotel) continue; // already has hotel
      if (space.houses >= MAX_HOUSES) continue; // needs hotel upgrade instead
      // Even building: can only build if this property has the min houses in the district
      if (houseCounts[i] <= minHouses) {
        buildable.push(indices[i]);
      }
    }
  }

  return buildable;
}

/**
 * Get properties where the player can upgrade to a hotel (4 houses → hotel).
 */
export function getHotelUpgradeableProperties(state: GameState, player: Player): number[] {
  const monopolies = getPlayerMonopolies(state, player.sessionId);
  const upgradeable: number[] = [];

  for (const district of monopolies) {
    const indices = DISTRICT_PROPERTIES[district];
    const cost = HOTEL_COST[district] || 100;
    if (player.coins < cost) continue;

    // Check if any property in the district is mortgaged - can't build if so
    const anyMortgaged = indices.some((idx) => state.boardSpaces[idx]?.isMortgaged);
    if (anyMortgaged) continue;

    // All properties in district must have 4 houses (even building)
    const allAtFour = indices.every((idx) => {
      const s = state.boardSpaces[idx];
      return s.houses === MAX_HOUSES || s.hasHotel;
    });

    if (!allAtFour) continue;

    for (const idx of indices) {
      const space = state.boardSpaces[idx];
      if (space.houses === MAX_HOUSES && !space.hasHotel) {
        upgradeable.push(idx);
      }
    }
  }

  return upgradeable;
}

/**
 * Build a house on a property. Returns result message.
 */
export function buildHouse(state: GameState, player: Player, spaceIndex: number): string {
  const space = state.boardSpaces[spaceIndex];
  if (!space || space.ownerId !== player.sessionId) {
    return "You don't own this property.";
  }
  if (!space.district) return "Cannot build here.";
  if (space.isMortgaged) return "Cannot build on a mortgaged property. Unmortgage it first.";

  const cost = HOUSE_COST[space.district] || 100;
  const buildable = getBuildableProperties(state, player);

  if (!buildable.includes(spaceIndex)) {
    return "Cannot build here right now. Build evenly across the district.";
  }

  if (player.coins < cost) {
    return "Not enough coins to build a house.";
  }

  player.coins -= cost;
  space.houses++;

  return `${player.displayName} built a house on ${space.name} for ${cost} coins! (${space.houses}/4 houses)`;
}

/**
 * Build a hotel on a property (replaces 4 houses). Returns result message.
 */
export function buildHotel(state: GameState, player: Player, spaceIndex: number): string {
  const space = state.boardSpaces[spaceIndex];
  if (!space || space.ownerId !== player.sessionId) {
    return "You don't own this property.";
  }
  if (!space.district) return "Cannot build here.";
  if (space.isMortgaged) return "Cannot build on a mortgaged property. Unmortgage it first.";

  const cost = HOTEL_COST[space.district] || 100;
  const upgradeable = getHotelUpgradeableProperties(state, player);

  if (!upgradeable.includes(spaceIndex)) {
    return "Cannot upgrade to hotel yet. Need 4 houses on all properties in this district.";
  }

  if (player.coins < cost) {
    return "Not enough coins to build a hotel.";
  }

  player.coins -= cost;
  space.houses = 0;
  space.hasHotel = true;

  return `${player.displayName} built a HOTEL on ${space.name} for ${cost} coins!`;
}

/**
 * Process landing on a property space.
 */
function processPropertyLanding(state: GameState, player: Player, space: BoardSpace): string {
  if (space.ownerId === "") {
    // Unowned property - player can buy or it goes to auction
    if (player.coins >= space.price) {
      state.awaitingBuy = true;
      return `${player.displayName} landed on ${space.name} (${space.price} coins). Buy it?`;
    } else {
      // Can't afford — start auction for this property
      const auctionResult = startAuction(state, space.index);
      return `${player.displayName} landed on ${space.name} but can't afford it (${space.price} coins). ${auctionResult}`;
    }
  } else if (space.ownerId === player.sessionId) {
    // Player owns this property
    return `${player.displayName} landed on their own property: ${space.name}.`;
  } else {
    // Another player owns this - pay rent (unless mortgaged)
    if (space.isMortgaged) {
      return `${player.displayName} landed on ${space.name} (mortgaged - no rent).`;
    }
    const owner = state.players.get(space.ownerId);
    if (owner && owner.isActive && !owner.isBankrupt) {
      const rentAmount = getEffectiveRent(state, space);
      return payRent(state, player, owner, rentAmount, space.name);
    }
    return `${player.displayName} landed on ${space.name} (owner is bankrupt).`;
  }
}

/**
 * Pay rent from one player to another.
 * If the player can't afford it and has assets to sell, start bankruptcy negotiation.
 */
function payRent(state: GameState, payer: Player, owner: Player, amount: number, spaceName: string): string {
  if (payer.coins >= amount) {
    payer.coins -= amount;
    owner.coins += amount;
    return `${payer.displayName} paid ${amount} coins rent to ${owner.displayName} for ${spaceName}.`;
  } else {
    // Player can't afford rent — check if they have assets to liquidate
    const totalAssetValue = calculateLiquidationValue(state, payer);
    if (totalAssetValue + payer.coins >= amount) {
      // Player has enough assets to potentially cover the debt — start negotiation
      startBankruptcyNegotiation(state, payer, owner.sessionId, amount, "rent");
      return `${payer.displayName} can't afford ${amount} coins rent to ${owner.displayName}! Bankruptcy negotiation started — sell assets to pay the debt!`;
    } else {
      // Player is completely bankrupt — no way to pay even by selling everything
      const remaining = payer.coins;
      owner.coins += remaining;
      payer.coins = 0;
      bankruptPlayer(state, payer, owner);
      return `${payer.displayName} went bankrupt to ${owner.displayName}! All properties transferred.`;
    }
  }
}

/**
 * Process landing on a tax space.
 * If the player can't afford it and has assets to sell, start bankruptcy negotiation.
 */
function processTaxLanding(state: GameState, player: Player, space: BoardSpace): string {
  let taxAmount = INCOME_TAX;
  if (space.name === "Luxury Tax") taxAmount = LUXURY_TAX;
  if (space.name === "Super Tax") taxAmount = SUPER_TAX;

  if (player.coins >= taxAmount) {
    player.coins -= taxAmount;
    return `${player.displayName} paid ${taxAmount} coins in tax.`;
  } else {
    // Check if they have assets to liquidate
    const totalAssetValue = calculateLiquidationValue(state, player);
    if (totalAssetValue + player.coins >= taxAmount) {
      startBankruptcyNegotiation(state, player, "", taxAmount, "tax");
      return `${player.displayName} can't afford ${taxAmount} coins in tax! Bankruptcy negotiation started — sell assets to pay!`;
    } else {
      player.coins = 0;
      bankruptPlayer(state, player);
      return `${player.displayName} couldn't pay ${taxAmount} coins in tax and went bankrupt!`;
    }
  }
}

/**
 * Buy a property for the current player.
 */
export function buyProperty(state: GameState, player: Player): string {
  const space = state.boardSpaces[player.position];

  if (space.spaceType !== "property") {
    return "This space is not a property.";
  }
  if (space.ownerId !== "") {
    return "This property is already owned.";
  }
  if (player.coins < space.price) {
    return "Not enough coins to buy this property.";
  }

  player.coins -= space.price;
  space.ownerId = player.sessionId;
  player.ownedProperties.push(space.index);
  state.awaitingBuy = false;

  return `${player.displayName} bought ${space.name} for ${space.price} coins!`;
}

/**
 * Skip buying a property (decline the purchase).
 */
export function skipBuy(state: GameState): string {
  state.awaitingBuy = false;
  return "Property purchase declined.";
}

/**
 * Mark a player as bankrupt and handle their properties.
 * If a creditor is provided, properties transfer to them (keeping mortgage status).
 * Otherwise, properties are released back to the bank.
 */
export function bankruptPlayer(state: GameState, player: Player, creditor?: Player): void {
  player.isBankrupt = true;
  player.isActive = false;

  for (let i = 0; i < player.ownedProperties.length; i++) {
    const spaceIndex = player.ownedProperties[i];
    const space = state.boardSpaces[spaceIndex];
    if (space) {
      // Buildings always go back to the bank
      space.houses = 0;
      space.hasHotel = false;

      if (creditor) {
        // Transfer to creditor (keep mortgage status)
        space.ownerId = creditor.sessionId;
        creditor.ownedProperties.push(spaceIndex);
      } else {
        // Release to bank
        space.ownerId = "";
        space.isMortgaged = false;
      }
    }
  }
  player.ownedProperties.clear();

  state.playerCount = getActivePlayers(state).length as any;
}

/**
 * Advance to the next player's turn.
 */
export function advanceTurn(state: GameState): string {
  state.hasRolled = false;
  state.awaitingBuy = false;

  // Reset doubles count for the player ending their turn
  const currentPlayer = getCurrentPlayer(state);
  if (currentPlayer) {
    currentPlayer.doublesCount = 0;
  }

  const activePlayers = getActivePlayers(state);
  if (activePlayers.length <= 1) {
    // Game over
    return endGame(state);
  }

  // Move to next player index
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % activePlayers.length;
  state.turnCount++;

  const nextPlayer = activePlayers[state.currentPlayerIndex];

  // Check max rounds
  if (state.turnCount >= MAX_ROUNDS * activePlayers.length) {
    return endGame(state);
  }

  return `${nextPlayer.displayName}'s turn.`;
}

/**
 * End the game and determine the winner.
 */
function endGame(state: GameState): string {
  state.phase = "finished";

  const activePlayers = getActivePlayers(state);
  if (activePlayers.length === 1) {
    state.winnerId = activePlayers[0].sessionId;
    return `${activePlayers[0].displayName} wins! All other players went bankrupt.`;
  }

  // Find richest player (coins + property values)
  let richest = activePlayers[0];
  let richestWealth = calculateWealth(state, richest);

  for (let i = 1; i < activePlayers.length; i++) {
    const wealth = calculateWealth(state, activePlayers[i]);
    if (wealth > richestWealth) {
      richest = activePlayers[i];
      richestWealth = wealth;
    }
  }

  state.winnerId = richest.sessionId;
  return `Game over! ${richest.displayName} wins with ${richestWealth} total wealth!`;
}

/**
 * Calculate total wealth for a player (coins + property values + building values).
 */
function calculateWealth(state: GameState, player: Player): number {
  let wealth = player.coins;
  for (let i = 0; i < player.ownedProperties.length; i++) {
    const spaceIndex = player.ownedProperties[i];
    const space = state.boardSpaces[spaceIndex];
    if (space) {
      wealth += space.price;
      // Add building values
      const houseCost = HOUSE_COST[space.district] || 0;
      const hotelCost = HOTEL_COST[space.district] || 0;
      if (space.hasHotel) {
        wealth += houseCost * MAX_HOUSES + hotelCost; // 4 houses + hotel
      } else {
        wealth += houseCost * space.houses;
      }
    }
  }
  return wealth;
}

/**
 * Check if the game should end (only 1 or 0 active players).
 */
export function checkGameOver(state: GameState): boolean {
  const activePlayers = getActivePlayers(state);
  return activePlayers.length <= 1;
}

/**
 * Validate a trade offer between two players.
 * Returns { valid: true } or { valid: false, error: string }.
 */
export function validateTradeOffer(
  state: GameState,
  fromSessionId: string,
  toSessionId: string,
  offeredProperties: number[],
  requestedProperties: number[],
  offeredCoins: number,
  requestedCoins: number
): { valid: boolean; error?: string } {
  if (fromSessionId === toSessionId) {
    return { valid: false, error: "Cannot trade with yourself." };
  }

  const fromPlayer = state.players.get(fromSessionId);
  const toPlayer = state.players.get(toSessionId);

  if (!fromPlayer || !fromPlayer.isActive || fromPlayer.isBankrupt) {
    return { valid: false, error: "You are not an active player." };
  }
  if (!toPlayer || !toPlayer.isActive || toPlayer.isBankrupt) {
    return { valid: false, error: "That player is not active." };
  }

  // Validate coins are non-negative
  if (offeredCoins < 0 || requestedCoins < 0) {
    return { valid: false, error: "Coin amounts cannot be negative." };
  }

  // Trade must have at least something being exchanged
  if (offeredProperties.length === 0 && requestedProperties.length === 0 && offeredCoins === 0 && requestedCoins === 0) {
    return { valid: false, error: "Trade must include at least one property or coins." };
  }

  // Validate fromPlayer owns all offered properties and they have no buildings
  for (const idx of offeredProperties) {
    const space = state.boardSpaces[idx];
    if (!space) {
      return { valid: false, error: `Invalid property index: ${idx}.` };
    }
    if (space.ownerId !== fromSessionId) {
      return { valid: false, error: `You don't own ${space.name}.` };
    }
    if (space.houses > 0 || space.hasHotel) {
      return { valid: false, error: `${space.name} has buildings. Sell them before trading.` };
    }
  }

  // Validate toPlayer owns all requested properties and they have no buildings
  for (const idx of requestedProperties) {
    const space = state.boardSpaces[idx];
    if (!space) {
      return { valid: false, error: `Invalid property index: ${idx}.` };
    }
    if (space.ownerId !== toSessionId) {
      return { valid: false, error: `${toPlayer.displayName} doesn't own ${space.name}.` };
    }
    if (space.houses > 0 || space.hasHotel) {
      return { valid: false, error: `${space.name} has buildings. Can't trade properties with buildings.` };
    }
  }

  // Validate sufficient coins
  if (fromPlayer.coins < offeredCoins) {
    return { valid: false, error: "You don't have enough coins for this trade." };
  }
  if (toPlayer.coins < requestedCoins) {
    return { valid: false, error: `${toPlayer.displayName} doesn't have enough coins.` };
  }

  return { valid: true };
}

/**
 * Execute a trade between two players. Swaps properties and coins.
 */
export function executeTrade(state: GameState): string {
  const trade = state.activeTrade;
  const fromPlayer = state.players.get(trade.fromSessionId);
  const toPlayer = state.players.get(trade.toSessionId);

  if (!fromPlayer || !toPlayer) {
    clearTrade(state);
    return "Trade failed: player not found.";
  }

  // Transfer offered properties: from → to
  for (let i = 0; i < trade.offeredProperties.length; i++) {
    const idx = trade.offeredProperties[i];
    const space = state.boardSpaces[idx];
    if (space) {
      space.ownerId = toPlayer.sessionId;
      // Remove from sender's ownedProperties
      const ownerIdx = Array.from(fromPlayer.ownedProperties).indexOf(idx);
      if (ownerIdx !== -1) {
        fromPlayer.ownedProperties.splice(ownerIdx, 1);
      }
      // Add to receiver's ownedProperties
      toPlayer.ownedProperties.push(idx);
    }
  }

  // Transfer requested properties: to → from
  for (let i = 0; i < trade.requestedProperties.length; i++) {
    const idx = trade.requestedProperties[i];
    const space = state.boardSpaces[idx];
    if (space) {
      space.ownerId = fromPlayer.sessionId;
      // Remove from receiver's ownedProperties
      const ownerIdx = Array.from(toPlayer.ownedProperties).indexOf(idx);
      if (ownerIdx !== -1) {
        toPlayer.ownedProperties.splice(ownerIdx, 1);
      }
      // Add to sender's ownedProperties
      fromPlayer.ownedProperties.push(idx);
    }
  }

  // Transfer coins
  if (trade.offeredCoins > 0) {
    fromPlayer.coins -= trade.offeredCoins;
    toPlayer.coins += trade.offeredCoins;
  }
  if (trade.requestedCoins > 0) {
    toPlayer.coins -= trade.requestedCoins;
    fromPlayer.coins += trade.requestedCoins;
  }

  const result = `${fromPlayer.displayName} and ${toPlayer.displayName} completed a trade!`;
  clearTrade(state);
  return result;
}

/**
 * Clear the active trade offer back to default state.
 */
export function clearTrade(state: GameState): void {
  state.activeTrade.status = "none";
  state.activeTrade.fromSessionId = "";
  state.activeTrade.toSessionId = "";
  state.activeTrade.offeredProperties.clear();
  state.activeTrade.requestedProperties.clear();
  state.activeTrade.offeredCoins = 0;
  state.activeTrade.requestedCoins = 0;
  state.activeTrade.counterOfferCount = 0;
  state.activeTrade.lastModifiedBy = "";
  state.activeTrade.isCounterOffer = false;
  state.activeTrade.prevOfferedProperties.clear();
  state.activeTrade.prevRequestedProperties.clear();
  state.activeTrade.prevOfferedCoins = 0;
  state.activeTrade.prevRequestedCoins = 0;
}

/**
 * Maximum number of counter-offer rounds allowed.
 */
export const MAX_COUNTER_OFFERS = 5;

/**
 * Process a counter-offer, swapping the trade direction and updating terms.
 * The counter-offerer becomes the new "from" and the original offerer becomes the new "to".
 * Returns a result message or an error string.
 */
export function processCounterOffer(
  state: GameState,
  counterOffererId: string,
  offeredProperties: number[],
  requestedProperties: number[],
  offeredCoins: number,
  requestedCoins: number
): { success: boolean; message: string } {
  const trade = state.activeTrade;

  if (trade.status !== "pending") {
    return { success: false, message: "No active trade to counter." };
  }

  if (trade.toSessionId !== counterOffererId) {
    return { success: false, message: "It's not your turn to respond to this trade." };
  }

  if (trade.counterOfferCount >= MAX_COUNTER_OFFERS) {
    return { success: false, message: `Maximum counter-offers (${MAX_COUNTER_OFFERS}) reached. Accept or reject.` };
  }

  // The counter-offerer is the current "to" player. After counter, they become "from".
  const otherSessionId = trade.fromSessionId;

  // Validate the counter-offer terms
  const validation = validateTradeOffer(
    state,
    counterOffererId,
    otherSessionId,
    offeredProperties,
    requestedProperties,
    offeredCoins,
    requestedCoins
  );

  if (!validation.valid) {
    return { success: false, message: validation.error || "Invalid counter-offer." };
  }

  // Save previous terms for diff display (stored from the OLD fromSessionId's perspective)
  trade.prevOfferedProperties.clear();
  for (let i = 0; i < trade.offeredProperties.length; i++) {
    trade.prevOfferedProperties.push(trade.offeredProperties[i]);
  }
  trade.prevRequestedProperties.clear();
  for (let i = 0; i < trade.requestedProperties.length; i++) {
    trade.prevRequestedProperties.push(trade.requestedProperties[i]);
  }
  trade.prevOfferedCoins = trade.offeredCoins;
  trade.prevRequestedCoins = trade.requestedCoins;

  // Swap direction: counter-offerer becomes "from", original proposer becomes "to"
  trade.fromSessionId = counterOffererId;
  trade.toSessionId = otherSessionId;

  // Set the new trade terms (from the counter-offerer's perspective)
  trade.offeredProperties.clear();
  for (const idx of offeredProperties) {
    trade.offeredProperties.push(idx);
  }
  trade.requestedProperties.clear();
  for (const idx of requestedProperties) {
    trade.requestedProperties.push(idx);
  }
  trade.offeredCoins = offeredCoins;
  trade.requestedCoins = requestedCoins;

  // Update counter-offer metadata
  trade.counterOfferCount++;
  trade.lastModifiedBy = counterOffererId;
  trade.isCounterOffer = true;

  const counterOfferer = state.players.get(counterOffererId);
  const otherPlayer = state.players.get(otherSessionId);

  return {
    success: true,
    message: `${counterOfferer?.displayName} sent a counter-offer to ${otherPlayer?.displayName}. (${trade.counterOfferCount}/${MAX_COUNTER_OFFERS})`,
  };
}

// ==================== Card Logic ====================

/**
 * Draw a card from a deck, apply its effect, and set drawnCard on state.
 * Returns [action message, updated deck].
 * The deck array is mutated (card popped from front); if empty, reshuffled.
 */
export function drawCard(
  state: GameState,
  player: Player,
  deckType: "community" | "chance",
  deck: string[]
): { message: string; deck: string[] } {
  // If deck is empty, reshuffle
  if (deck.length === 0) {
    const source = deckType === "community" ? COMMUNITY_CARDS : CHANCE_CARDS;
    const ids = source.map((c) => c.id);
    // Fisher-Yates shuffle
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    deck = ids;
  }

  const cardId = deck.shift()!;
  const card = getCardById(cardId);

  if (!card) {
    return { message: `${player.displayName} drew a card but it was blank!`, deck };
  }

  // Set drawn card on state for client display
  state.drawnCard.deck = deckType;
  state.drawnCard.title = card.title;
  state.drawnCard.description = card.description;
  state.drawnCard.forSessionId = player.sessionId;

  // Apply effect
  const effectMessage = applyCardEffect(state, card, player);

  return { message: effectMessage, deck };
}

/**
 * Apply a card's effect to the game state.
 */
function applyCardEffect(state: GameState, card: CardDefinition, player: Player): string {
  const amount = card.amount ?? 0;

  switch (card.effect) {
    case "gain_coins": {
      player.coins += amount;
      return `${player.displayName} drew "${card.title}" — ${card.description}`;
    }

    case "lose_coins": {
      if (player.coins >= amount) {
        player.coins -= amount;
      } else {
        // Check if they have assets to liquidate
        const totalAssetValue = calculateLiquidationValue(state, player);
        if (totalAssetValue + player.coins >= amount) {
          startBankruptcyNegotiation(state, player, "", amount, "card");
          return `${player.displayName} drew "${card.title}" but can't afford ${amount} coins! Bankruptcy negotiation started!`;
        } else {
          player.coins = 0;
          bankruptPlayer(state, player);
          return `${player.displayName} drew "${card.title}" and went bankrupt!`;
        }
      }
      return `${player.displayName} drew "${card.title}" — ${card.description}`;
    }

    case "move_to": {
      const targetSpace = card.targetSpace ?? 0;
      const oldPos = player.position;

      // Check if player passes Payday (index 0) by moving forward
      // We determine "forward" by checking if target < current position (wrapping around)
      const passedPayday = targetSpace <= oldPos && targetSpace !== oldPos;
      if (passedPayday && targetSpace === 0) {
        // Moving to Payday itself — they land on it, bonus given for passing
        player.coins += PAYDAY_BONUS;
      } else if (passedPayday) {
        player.coins += PAYDAY_BONUS;
      }

      player.position = targetSpace;

      // Process landing at the new space (may trigger buy prompt, rent, tax, etc.)
      const landingMsg = processLanding(state, player);

      return `${player.displayName} drew "${card.title}" — moved to ${state.boardSpaces[targetSpace].name}. ${landingMsg}`;
    }

    case "move_relative": {
      const newPos = ((player.position + amount) % TOTAL_SPACES + TOTAL_SPACES) % TOTAL_SPACES;
      const passedPayday = amount > 0 && newPos < player.position;
      if (passedPayday) {
        player.coins += PAYDAY_BONUS;
      }

      player.position = newPos;
      const landingMsg = processLanding(state, player);

      const direction = amount > 0 ? "forward" : "back";
      return `${player.displayName} drew "${card.title}" — moved ${direction} ${Math.abs(amount)} spaces. ${landingMsg}`;
    }

    case "collect_from_players": {
      const activePlayers = getActivePlayers(state);
      let totalCollected = 0;
      for (const other of activePlayers) {
        if (other.sessionId === player.sessionId) continue;
        const payment = Math.min(other.coins, amount);
        other.coins -= payment;
        totalCollected += payment;
        if (other.coins <= 0) {
          // Don't bankrupt for failing to pay birthday money
        }
      }
      player.coins += totalCollected;
      return `${player.displayName} drew "${card.title}" — collected ${totalCollected} coins from other players!`;
    }

    case "jail_free_card": {
      player.jailFreeCards++;
      return `${player.displayName} drew "${card.title}" — card kept for later use!`;
    }

    case "pay_to_players": {
      const activePlayers = getActivePlayers(state);
      const otherCount = activePlayers.filter((p) => p.sessionId !== player.sessionId).length;
      const totalCost = amount * otherCount;

      if (player.coins >= totalCost) {
        player.coins -= totalCost;
        for (const other of activePlayers) {
          if (other.sessionId === player.sessionId) continue;
          other.coins += amount;
        }
        return `${player.displayName} drew "${card.title}" — paid ${totalCost} coins to other players!`;
      } else {
        // Check if they have assets to liquidate
        const totalAssetValue = calculateLiquidationValue(state, player);
        if (totalAssetValue + player.coins >= totalCost) {
          startBankruptcyNegotiation(state, player, "", totalCost, "card");
          return `${player.displayName} drew "${card.title}" but can't afford ${totalCost} coins! Bankruptcy negotiation started!`;
        } else {
          // Pay what they can, then bankrupt
          const perPlayer = Math.floor(player.coins / Math.max(otherCount, 1));
          for (const other of activePlayers) {
            if (other.sessionId === player.sessionId) continue;
            other.coins += perPlayer;
          }
          player.coins = 0;
          bankruptPlayer(state, player);
          return `${player.displayName} drew "${card.title}" and went bankrupt!`;
        }
      }
    }

    default:
      return `${player.displayName} drew a card.`;
  }
}

/**
 * Clear the drawn card display.
 */
export function clearDrawnCard(state: GameState): void {
  state.drawnCard.deck = "";
  state.drawnCard.title = "";
  state.drawnCard.description = "";
  state.drawnCard.forSessionId = "";
}

// ==================== Mortgage Logic ====================

/**
 * Calculate the mortgage value for a property (50% of price).
 */
export function getMortgageValue(space: BoardSpace): number {
  return Math.floor(space.price / 2);
}

/**
 * Calculate the cost to unmortgage a property (mortgage value + 10% interest = 55% of price).
 */
export function getUnmortgageCost(space: BoardSpace): number {
  return Math.floor(space.price * 0.55);
}

/**
 * Get properties that a player can mortgage.
 * Rules: must own the property, no buildings, not already mortgaged.
 */
export function getMortgageableProperties(state: GameState, player: Player): number[] {
  const mortgageable: number[] = [];
  
  for (let i = 0; i < player.ownedProperties.length; i++) {
    const spaceIndex = player.ownedProperties[i];
    const space = state.boardSpaces[spaceIndex];
    
    if (!space) continue;
    if (space.isMortgaged) continue;
    if (space.houses > 0 || space.hasHotel) continue;
    
    mortgageable.push(spaceIndex);
  }
  
  return mortgageable;
}

/**
 * Get mortgaged properties that a player can unmortgage.
 * Rules: must be mortgaged and player must have enough coins.
 */
export function getUnmortgageableProperties(state: GameState, player: Player): number[] {
  const unmortgageable: number[] = [];
  
  for (let i = 0; i < player.ownedProperties.length; i++) {
    const spaceIndex = player.ownedProperties[i];
    const space = state.boardSpaces[spaceIndex];
    
    if (!space) continue;
    if (!space.isMortgaged) continue;
    
    const cost = getUnmortgageCost(space);
    if (player.coins >= cost) {
      unmortgageable.push(spaceIndex);
    }
  }
  
  return unmortgageable;
}

/**
 * Mortgage a property. Player receives 50% of the property price.
 * Returns result message.
 */
export function mortgageProperty(state: GameState, player: Player, spaceIndex: number): string {
  const space = state.boardSpaces[spaceIndex];
  
  if (!space) {
    return "Invalid property.";
  }
  if (space.ownerId !== player.sessionId) {
    return "You don't own this property.";
  }
  if (space.isMortgaged) {
    return "This property is already mortgaged.";
  }
  if (space.houses > 0 || space.hasHotel) {
    return "Cannot mortgage a property with buildings. Sell them first.";
  }
  
  const mortgageValue = getMortgageValue(space);
  space.isMortgaged = true;
  player.coins += mortgageValue;
  
  return `${player.displayName} mortgaged ${space.name} for ${mortgageValue} coins.`;
}

/**
 * Unmortgage a property. Player pays mortgage value + 10% interest.
 * Returns result message.
 */
export function unmortgageProperty(state: GameState, player: Player, spaceIndex: number): string {
  const space = state.boardSpaces[spaceIndex];
  
  if (!space) {
    return "Invalid property.";
  }
  if (space.ownerId !== player.sessionId) {
    return "You don't own this property.";
  }
  if (!space.isMortgaged) {
    return "This property is not mortgaged.";
  }
  
  const cost = getUnmortgageCost(space);
  if (player.coins < cost) {
    return `Not enough coins to unmortgage. Need ${cost} coins.`;
  }
  
  player.coins -= cost;
  space.isMortgaged = false;
  
  return `${player.displayName} unmortgaged ${space.name} for ${cost} coins.`;
}

// ==================== Sell Building Logic ====================

/**
 * Calculate the sell value for a house (50% of house cost).
 */
export function getHouseSellValue(district: string): number {
  const houseCost = HOUSE_COST[district] || 100;
  return Math.floor(houseCost / 2);
}

/**
 * Calculate the sell value for a hotel (50% of hotel cost).
 */
export function getHotelSellValue(district: string): number {
  const hotelCost = HOTEL_COST[district] || 100;
  return Math.floor(hotelCost / 2);
}

/**
 * Get properties where the player can sell a house.
 * Rules: must own the property, must have at least 1 house (no hotel),
 * and must follow even selling (can only sell from properties with MAX houses in district).
 */
export function getSellableHouseProperties(state: GameState, player: Player): number[] {
  const monopolies = getPlayerMonopolies(state, player.sessionId);
  const sellable: number[] = [];

  for (const district of monopolies) {
    const indices = DISTRICT_PROPERTIES[district];
    
    // Get current house counts (hotels count as 5)
    const houseCounts = indices.map((idx) => {
      const s = state.boardSpaces[idx];
      return s.hasHotel ? 5 : s.houses;
    });
    const maxHouses = Math.max(...houseCounts);

    // Can only sell houses (not hotels) - hotels must be sold separately
    // Even selling: can only sell from properties with the max houses in the district
    for (let i = 0; i < indices.length; i++) {
      const space = state.boardSpaces[indices[i]];
      if (space.hasHotel) continue; // must sell hotel first
      if (space.houses === 0) continue; // no houses to sell
      // Even selling: can only sell if this property has the max houses in the district
      if (houseCounts[i] >= maxHouses) {
        sellable.push(indices[i]);
      }
    }
  }

  return sellable;
}

/**
 * Get properties where the player can sell a hotel.
 * Rules: must own the property, must have a hotel,
 * and for even selling: all other properties in district must have 4 houses or a hotel.
 */
export function getSellableHotelProperties(state: GameState, player: Player): number[] {
  const monopolies = getPlayerMonopolies(state, player.sessionId);
  const sellable: number[] = [];

  for (const district of monopolies) {
    const indices = DISTRICT_PROPERTIES[district];
    
    // Get current house counts (hotels count as 5)
    const houseCounts = indices.map((idx) => {
      const s = state.boardSpaces[idx];
      return s.hasHotel ? 5 : s.houses;
    });
    const maxHouses = Math.max(...houseCounts);

    // For hotels, we need to check even selling
    // Can only sell a hotel if it's at the max level in the district
    for (let i = 0; i < indices.length; i++) {
      const space = state.boardSpaces[indices[i]];
      if (!space.hasHotel) continue; // no hotel to sell
      // Even selling: can only sell if this property has the max (which is 5 for hotel)
      if (houseCounts[i] >= maxHouses) {
        sellable.push(indices[i]);
      }
    }
  }

  return sellable;
}

/**
 * Sell a house from a property. Player receives 50% of house cost.
 * Returns result message.
 */
export function sellHouse(state: GameState, player: Player, spaceIndex: number): string {
  const space = state.boardSpaces[spaceIndex];
  
  if (!space) {
    return "Invalid property.";
  }
  if (space.ownerId !== player.sessionId) {
    return "You don't own this property.";
  }
  if (space.hasHotel) {
    return "This property has a hotel. Sell the hotel first.";
  }
  if (space.houses === 0) {
    return "This property has no houses to sell.";
  }
  if (!space.district) {
    return "Cannot sell buildings here.";
  }
  
  const sellable = getSellableHouseProperties(state, player);
  if (!sellable.includes(spaceIndex)) {
    return "Cannot sell here. Sell evenly across the district (sell from properties with the most houses first).";
  }
  
  const sellValue = getHouseSellValue(space.district);
  space.houses--;
  player.coins += sellValue;
  
  return `${player.displayName} sold a house on ${space.name} for ${sellValue} coins. (${space.houses}/4 houses)`;
}

/**
 * Sell a hotel from a property. Player receives 50% of hotel cost.
 * If convertToHouses is true, the hotel is converted back to 4 houses (no additional cost in standard rules).
 * If convertToHouses is false, all buildings are removed.
 * Returns result message.
 */
export function sellHotel(state: GameState, player: Player, spaceIndex: number, convertToHouses: boolean): string {
  const space = state.boardSpaces[spaceIndex];
  
  if (!space) {
    return "Invalid property.";
  }
  if (space.ownerId !== player.sessionId) {
    return "You don't own this property.";
  }
  if (!space.hasHotel) {
    return "This property doesn't have a hotel.";
  }
  if (!space.district) {
    return "Cannot sell buildings here.";
  }
  
  const sellable = getSellableHotelProperties(state, player);
  if (!sellable.includes(spaceIndex)) {
    return "Cannot sell here. Sell evenly across the district.";
  }
  
  const sellValue = getHotelSellValue(space.district);
  space.hasHotel = false;
  player.coins += sellValue;
  
  if (convertToHouses) {
    // Convert back to 4 houses
    space.houses = MAX_HOUSES;
    return `${player.displayName} sold the hotel on ${space.name} for ${sellValue} coins and kept 4 houses.`;
  } else {
    // Remove all buildings
    space.houses = 0;
    return `${player.displayName} sold the hotel on ${space.name} for ${sellValue} coins.`;
  }
}

// ==================== Bankruptcy Negotiation Logic ====================

const BANKRUPTCY_NEGOTIATION_DURATION = 45; // seconds

/**
 * Calculate the total value a player could raise by selling all buildings
 * and mortgaging all unmortgaged properties.
 */
export function calculateLiquidationValue(state: GameState, player: Player): number {
  let value = 0;

  for (let i = 0; i < player.ownedProperties.length; i++) {
    const spaceIndex = player.ownedProperties[i];
    const space = state.boardSpaces[spaceIndex];
    if (!space) continue;

    // Value from selling hotel
    if (space.hasHotel && space.district) {
      const hotelSell = Math.floor((HOTEL_COST[space.district] || 100) / 2);
      value += hotelSell;
      // After selling hotel, the 4 houses that went into it can also be sold
      const houseSell = Math.floor((HOUSE_COST[space.district] || 100) / 2);
      value += houseSell * MAX_HOUSES;
    }

    // Value from selling houses
    if (space.houses > 0 && space.district) {
      const houseSell = Math.floor((HOUSE_COST[space.district] || 100) / 2);
      value += houseSell * space.houses;
    }

    // Value from mortgaging (if not already mortgaged and no buildings)
    // For properties with buildings, we account for mortgage after buildings are sold
    if (!space.isMortgaged) {
      value += Math.floor(space.price / 2); // mortgage value
    }
  }

  return value;
}

/**
 * Start a bankruptcy negotiation phase for a player who can't pay a debt.
 */
export function startBankruptcyNegotiation(
  state: GameState,
  debtor: Player,
  creditorSessionId: string,
  amount: number,
  reason: string
): void {
  const negotiation = state.bankruptcyNegotiation;
  negotiation.status = "active";
  negotiation.debtorSessionId = debtor.sessionId;
  negotiation.creditorSessionId = creditorSessionId;
  negotiation.amountOwed = amount;
  negotiation.reason = reason;
  negotiation.deadline = Math.floor(Date.now() / 1000) + BANKRUPTCY_NEGOTIATION_DURATION;
}

/**
 * Clear the bankruptcy negotiation state.
 */
export function clearBankruptcyNegotiation(state: GameState): void {
  const negotiation = state.bankruptcyNegotiation;
  negotiation.status = "none";
  negotiation.debtorSessionId = "";
  negotiation.creditorSessionId = "";
  negotiation.amountOwed = 0;
  negotiation.reason = "";
  negotiation.deadline = 0;
}

/**
 * Resolve the bankruptcy negotiation by paying the debt.
 * Returns a result message or null if payment can't be made.
 */
export function resolveBankruptcyPayment(state: GameState): string | null {
  const negotiation = state.bankruptcyNegotiation;
  if (negotiation.status !== "active") return null;

  const debtor = state.players.get(negotiation.debtorSessionId);
  if (!debtor) return null;

  if (debtor.coins < negotiation.amountOwed) return null;

  const amount = negotiation.amountOwed;
  const creditorId = negotiation.creditorSessionId;

  if (creditorId) {
    // Pay to creditor (another player)
    const creditor = state.players.get(creditorId);
    if (creditor) {
      debtor.coins -= amount;
      creditor.coins += amount;
      clearBankruptcyNegotiation(state);
      return `${debtor.displayName} raised enough funds and paid ${amount} coins to ${creditor.displayName}!`;
    }
  }

  // Pay to bank (tax, card, etc.)
  debtor.coins -= amount;
  clearBankruptcyNegotiation(state);
  return `${debtor.displayName} raised enough funds and paid ${amount} coins!`;
}

/**
 * Handle a player declaring bankruptcy during negotiation.
 * Transfers remaining assets to creditor (or bank).
 */
export function declareBankruptcy(state: GameState): string {
  const negotiation = state.bankruptcyNegotiation;
  const debtor = state.players.get(negotiation.debtorSessionId);
  if (!debtor) {
    clearBankruptcyNegotiation(state);
    return "Bankruptcy declared.";
  }

  const creditorId = negotiation.creditorSessionId;
  let creditor: Player | undefined;

  if (creditorId) {
    creditor = state.players.get(creditorId);
    if (creditor) {
      // Transfer remaining coins to creditor
      creditor.coins += debtor.coins;
    }
  }
  debtor.coins = 0;

  bankruptPlayer(state, debtor, creditor);
  clearBankruptcyNegotiation(state);

  if (creditor) {
    return `${debtor.displayName} declared bankruptcy! All assets transferred to ${creditor.displayName}.`;
  }
  return `${debtor.displayName} declared bankruptcy! All properties returned to the bank.`;
}

/**
 * Handle bankruptcy negotiation timeout.
 * Same as declaring bankruptcy.
 */
export function handleBankruptcyTimeout(state: GameState): string {
  const negotiation = state.bankruptcyNegotiation;
  const debtor = state.players.get(negotiation.debtorSessionId);
  if (!debtor) {
    clearBankruptcyNegotiation(state);
    return "Bankruptcy negotiation timed out.";
  }

  return declareBankruptcy(state);
}

/**
 * Check if bankruptcy negotiation has timed out.
 */
export function isBankruptcyTimedOut(state: GameState): boolean {
  const negotiation = state.bankruptcyNegotiation;
  if (negotiation.status !== "active") return false;
  const now = Math.floor(Date.now() / 1000);
  return now >= negotiation.deadline;
}

// ==================== Auction Logic ====================

/**
 * Start an auction for a property.
 * Called when a player declines to buy a property they landed on.
 */
export function startAuction(state: GameState, propertyIndex: number): string {
  const space = state.boardSpaces[propertyIndex];
  if (!space || space.spaceType !== "property") {
    return "Cannot auction this space.";
  }
  if (space.ownerId !== "") {
    return "This property is already owned.";
  }

  state.activeAuction.status = "active";
  state.activeAuction.propertyIndex = propertyIndex;
  state.activeAuction.currentBid = 0;
  state.activeAuction.highestBidderId = "";
  state.activeAuction.passedPlayers.clear();

  return `${space.name} is now up for auction! Minimum bid: 1 coin.`;
}

/**
 * Place a bid in the current auction.
 * Returns result message.
 */
export function placeBid(state: GameState, player: Player, amount: number): string {
  const auction = state.activeAuction;

  if (auction.status !== "active") {
    return "No auction is currently active.";
  }
  if (!player.isActive || player.isBankrupt) {
    return "You cannot participate in this auction.";
  }
  if (amount <= auction.currentBid) {
    return `Bid must be higher than the current bid of ${auction.currentBid} coins.`;
  }
  if (amount < 1) {
    return "Minimum bid is 1 coin.";
  }
  if (player.coins < amount) {
    return `You don't have enough coins. You have ${player.coins} coins.`;
  }

  // Update auction state
  auction.currentBid = amount;
  auction.highestBidderId = player.sessionId;

  // Remove from passed players (in case they passed then decided to bid)
  if (auction.passedPlayers.has(player.sessionId)) {
    auction.passedPlayers.delete(player.sessionId);
  }

  const space = state.boardSpaces[auction.propertyIndex];

  // Check if auction should end (all other active players have passed)
  const endResult = checkAuctionEnd(state);
  if (endResult) {
    return endResult;
  }

  return `${player.displayName} bid ${amount} coins for ${space.name}!`;
}

/**
 * Pass on the current auction.
 * Returns result message.
 */
export function passAuction(state: GameState, player: Player): string {
  const auction = state.activeAuction;

  if (auction.status !== "active") {
    return "No auction is currently active.";
  }
  if (!player.isActive || player.isBankrupt) {
    return "You cannot participate in this auction.";
  }
  if (auction.passedPlayers.has(player.sessionId)) {
    return "You have already passed.";
  }
  // Highest bidder cannot pass (they're winning)
  if (player.sessionId === auction.highestBidderId) {
    return "You cannot pass while you are the highest bidder.";
  }

  // Add to passed players
  auction.passedPlayers.add(player.sessionId);

  // Check if auction should end
  const endResult = checkAuctionEnd(state);
  if (endResult) {
    return endResult;
  }

  return `${player.displayName} passed on the auction.`;
}

/**
 * Check if the auction should end and end it if so.
 * Auction ends when all active players except the highest bidder have passed.
 * Returns end message if auction ended, null otherwise.
 */
export function checkAuctionEnd(state: GameState): string | null {
  const auction = state.activeAuction;

  if (auction.status !== "active") {
    return null;
  }

  const activePlayers = getActivePlayers(state);
  const activePlayerCount = activePlayers.length;

  // Count how many active players have passed
  let passedCount = 0;
  for (const player of activePlayers) {
    if (auction.passedPlayers.has(player.sessionId)) {
      passedCount++;
    }
  }

  // If highest bidder exists, they don't count as needing to pass
  // Auction ends when all OTHER active players have passed
  const playersWhoNeedToPass = auction.highestBidderId
    ? activePlayerCount - 1 // Everyone except the highest bidder
    : activePlayerCount; // Everyone (no bidder yet)

  // End if all players who need to pass have passed
  if (passedCount >= playersWhoNeedToPass) {
    return endAuction(state);
  }

  return null;
}

/**
 * End the current auction.
 * Transfers property to highest bidder or leaves it unowned.
 * Returns result message.
 */
export function endAuction(state: GameState): string {
  const auction = state.activeAuction;
  const space = state.boardSpaces[auction.propertyIndex];
  let result: string;

  if (auction.highestBidderId && auction.currentBid > 0) {
    // Someone won the auction
    const winner = state.players.get(auction.highestBidderId);
    if (winner) {
      winner.coins -= auction.currentBid;
      space.ownerId = winner.sessionId;
      winner.ownedProperties.push(space.index);
      result = `${winner.displayName} won ${space.name} for ${auction.currentBid} coins!`;
    } else {
      result = `Auction ended but winner not found. ${space.name} remains unowned.`;
    }
  } else {
    // No bids - property remains unowned
    result = `No bids placed. ${space.name} remains unowned.`;
  }

  // Clear auction state
  clearAuction(state);

  return result;
}

/**
 * Clear the auction state.
 */
export function clearAuction(state: GameState): void {
  state.activeAuction.status = "none";
  state.activeAuction.propertyIndex = 0;
  state.activeAuction.currentBid = 0;
  state.activeAuction.highestBidderId = "";
  state.activeAuction.passedPlayers.clear();
}

/**
 * Handle a player disconnecting during an auction.
 * Marks them as passed. If they were the highest bidder, the auction continues without them.
 */
export function handlePlayerDisconnectAuction(state: GameState, sessionId: string): void {
  const auction = state.activeAuction;

  if (auction.status !== "active") {
    return;
  }

  // If player was highest bidder, clear that
  if (auction.highestBidderId === sessionId) {
    auction.highestBidderId = "";
    auction.currentBid = 0;
  }

  // Mark as passed
  if (!auction.passedPlayers.has(sessionId)) {
    auction.passedPlayers.add(sessionId);
  }

  // Check if auction should end
  checkAuctionEnd(state);
}
