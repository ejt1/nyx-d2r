declare module 'd2r/monster' {
  import { Unit } from 'd2r/unit';

  export class Monster extends Unit {
    readonly isAlive: boolean;
    readonly isAttacking: boolean;
    readonly isNeutral: boolean;
  }
}
