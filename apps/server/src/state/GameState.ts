import { Schema, type, ArraySchema, MapSchema } from "@colyseus/schema";

export class TradeOffer extends Schema {
  @type("string") status: string = "none"; // none, pending
  @type("string") fromSessionId: string = "";
  @type("string") toSessionId: string = "";
  @type(["uint8"]) offeredProperties = new ArraySchema<number>();
  @type(["uint8"]) requestedProperties = new ArraySchema<number>();
  @type("int32") offeredCoins: number = 0;
  @type("int32") requestedCoins: number = 0;
}

export class DrawnCard extends Schema {
  @type("string") deck: string = "";          // "community" | "chance" | ""
  @type("string") title: string = "";
  @type("string") description: string = "";
  @type("string") forSessionId: string = "";  // who drew it
}

export class BoardSpace extends Schema {
  @type("uint8") index: number = 0;
  @type("string") name: string = "";
  @type("string") spaceType: string = "property"; // property, tax, payday, jail, parking, goToJail, community, chance
  @type("string") district: string = "";
  @type("uint16") price: number = 0;
  @type("uint16") rent: number = 0;
  @type("string") ownerId: string = ""; // sessionId of owner, empty = unowned
  @type("uint8") houses: number = 0; // 0-4 houses
  @type("boolean") hasHotel: boolean = false;
}

export class Player extends Schema {
  @type("string") sessionId: string = "";
  @type("string") discordUserId: string = "";
  @type("string") displayName: string = "";
  @type("string") avatarUrl: string = "";
  @type("uint8") position: number = 0;
  @type("int32") coins: number = 1500;
  @type(["uint8"]) ownedProperties = new ArraySchema<number>();
  @type("boolean") isActive: boolean = true;
  @type("boolean") isBankrupt: boolean = false;
  @type("boolean") inJail: boolean = false;
  @type("uint8") jailTurnsRemaining: number = 0;
  @type("uint8") jailFreeCards: number = 0;
  @type("uint8") playerIndex: number = 0;
  @type("string") pieceId: string = "car";
}

export class GameState extends Schema {
  @type("string") phase: string = "lobby"; // lobby, playing, finished
  @type("uint8") currentPlayerIndex: number = 0;
  @type({ map: Player }) players = new MapSchema<Player>();
  @type([BoardSpace]) boardSpaces = new ArraySchema<BoardSpace>();
  @type("uint8") dice1: number = 0;
  @type("uint8") dice2: number = 0;
  @type("uint16") turnCount: number = 0;
  @type("string") winnerId: string = "";
  @type("string") hostSessionId: string = "";
  @type("uint8") playerCount: number = 0;
  @type("string") lastAction: string = ""; // Describes the last action for UI feedback
  @type("boolean") awaitingBuy: boolean = false; // True when current player can buy a property
  @type("boolean") hasRolled: boolean = false; // True when current player has rolled this turn
  @type(TradeOffer) activeTrade = new TradeOffer();
  @type(DrawnCard) drawnCard = new DrawnCard();
}
