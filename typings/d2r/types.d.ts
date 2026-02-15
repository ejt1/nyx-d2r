declare module 'd2r/types' {
  export const UnitTypes: {
    readonly Player: 0;
    readonly Monster: 1;
    readonly Object: 2;
    readonly Missile: 3;
    readonly Item: 4;
    readonly Tile: 5;
  };

  export const PlayerModes: {
    readonly Death: 0;
    readonly Neutral: 1;
    readonly Walk: 2;
    readonly Run: 3;
    readonly GetHit: 4;
    readonly TownNeutral: 5;
    readonly TownWalk: 6;
    readonly Attack1: 7;
    readonly Attack2: 8;
    readonly Block: 9;
    readonly Cast: 10;
    readonly Throw: 11;
    readonly Kick: 12;
    readonly Skill1: 13;
    readonly Skill2: 14;
    readonly Skill3: 15;
    readonly Skill4: 16;
    readonly Dead: 17;
    readonly Sequence: 18;
    readonly KnockBack: 19;
  };

  export const MonsterModes: {
    readonly Death: 0;
    readonly Neutral: 1;
    readonly Walk: 2;
    readonly GetHit: 3;
    readonly Attack1: 4;
    readonly Attack2: 5;
    readonly Block: 6;
    readonly Cast: 7;
    readonly Skill1: 8;
    readonly Skill2: 9;
    readonly Skill3: 10;
    readonly Skill4: 11;
    readonly Dead: 12;
    readonly Knockback: 13;
    readonly Sequence: 14;
    readonly Run: 15;
  };

  export const ItemModes: {
    readonly Stored: 0;
    readonly Equipped: 1;
    readonly InBelt: 2;
    readonly OnGround: 3;
    readonly OnCursor: 4;
    readonly Dropping: 5;
    readonly Socketed: 6;
  };
}
