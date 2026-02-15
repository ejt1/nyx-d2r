declare module 'd2r/player' {
  import { Unit } from 'd2r/unit';

  export class Player extends Unit {
    readonly isLocalPlayer: boolean;
    readonly isAlive: boolean;
    readonly isInTown: boolean;
    readonly isRunning: boolean;
  }

  export class LocalPlayer extends Player {
    readonly isLocalPlayer: true;
  }
}
