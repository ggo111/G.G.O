import Matter from 'matter-js';
import { ARENAS, ROOM_WEAPONS } from '../data/gameCatalog.ts';
import type { WeaponStats } from '../data/shopTypes.ts';
import { getWeaponById } from '../data/weapons.ts';
import type {
  AIDifficulty,
  ArenaDef,
  BattleFormat,
  CosmeticsEquipped,
  DrawnBlueprint,
  HealthPickupSnapshot,
  MatchMode,
  MatchPhase,
  MatchSnapshot,
  PlayerInputState,
  RoomWeaponId,
  VehicleSnapshot,
  VisualEffectEvent,
} from '../types/game.ts';
import { compileDrawnBlueprint, getPresetStrokes, type PresetKind } from '../utils/shapeCompiler.ts';
import { log } from '../utils/debugLog.ts';

const { Engine, World, Bodies, Body, Constraint, Events, Query } = Matter;

export interface SimParticipantInit {
  playerId: string;
  nickname: string;
  isBot: boolean;
  botDifficulty?: AIDifficulty;
  botArchetype?: PresetKind;
  teamId: 1 | 2;
  roomWeapon: RoomWeaponId | null;
  cosmetics: CosmeticsEquipped;
  connected?: boolean;
}

interface InternalVehicle {
  init: SimParticipantInit;
  blueprint: DrawnBlueprint | null;
  chassis: Matter.Body | null;
  rider: Matter.Body | null;
  headSensor: Matter.Body | null;
  riderJoint: Matter.Constraint | null;
  facing: 1 | -1;
  lanceAngle: number;
  riderHp: number;
  maxRiderHp: number;
  chassisHp: number;
  maxChassisHp: number;
  boostEnergy: number;
  boosting: boolean;
  jumpCooldownMs: number;
  weaponCooldownMs: number;
  weaponMaxCooldownMs: number;
  weaponStats: WeaponStats;
  weaponLengthScale: number;
  weaponHeadScale: number;
  shieldActiveMs: number;
  magnetActiveMs: number;
  slamArmed: boolean;
  input: PlayerInputState;
  pendingJump: boolean;
  prevInputJump: boolean;
  pendingSpecial: boolean;
  prevInputSpecial: boolean;
  eliminated: boolean;
  eliminationReason?: string;
  roundWins: number;
  lastHitAtMs: number;
  headInvulnMs: number;
  headFlashMs: number;
  connected: boolean;
  reconnectRemainingSec?: number;
  aiThinkTimerMs: number;
}

const DRAW_PHASE_MS = 15_000;
const COUNTDOWN_MS = 3_000;
const ROUND_END_MS = 2_600;
const SUDDEN_DEATH_MS = 15_000;
const FIXED_STEP_MS = 1000 / 60;
const MAX_STEPS_PER_FRAME = 3;
const HEAD_SENSOR_RADIUS = 22;
const HEAD_INVULN_MS = 400;
const MIN_HEAD_HIT_REL_SPEED = 1.8;
const PICKUP_SPAWN_Y = -280;
const PICKUP_FALL_SPEED_PX_SEC = 116;
const PICKUP_TTL_MS = 12_000;
const PICKUP_FADE_MS = 1_200;
const PICKUP_HEAL_RATIO = 0.30;

function pointToSegmentDist(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): { dist: number; cx: number; cy: number } {
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  if (lenSq <= 0.0001) {
    return { dist: Math.hypot(px - ax, py - ay), cx: ax, cy: ay };
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / lenSq));
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  return { dist: Math.hypot(px - cx, py - cy), cx, cy };
}

export class GGOArenaSimulation {
  public readonly matchId: string;
  public readonly mode: MatchMode;
  public readonly battleFormat: BattleFormat;
  public readonly arena: ArenaDef;
  public readonly seed: number;
  public readonly roundsToWin = 2;
  public readonly roundDurationMs: number;

  private engine: Matter.Engine;
  private platformBodies: Matter.Body[] = [];
  private vehicles: Map<string, InternalVehicle> = new Map();
  private bodyToPlayerId: Map<number, string> = new Map();

  public roundIndex = 1;
  public phase: MatchPhase = 'DRAWING';
  public phaseRemainingMs = DRAW_PHASE_MS;
  public suddenDeath = false;
  public roundWinnerIds: string[] = [];
  public matchWinnerIds: string[] = [];
  public koSummary = '';

  private pendingFx: VisualEffectEvent[] = [];
  private fxSeq = 0;
  private physicsAccumulatorMs = 0;
  private slowMoRemainingMs = 0;
  private activePickup: HealthPickupSnapshot | null = null;
  private pickupSpawnedThisRound = false;
  private pickupLandingY = 180;
  private pickupSeq = 0;

  constructor(params: {
    matchId: string;
    mode: MatchMode;
    battleFormat: BattleFormat;
    arenaId: string;
    seed?: number;
    roundDurationSec?: number;
    participants: SimParticipantInit[];
  }) {
    this.matchId = params.matchId;
    this.mode = params.mode;
    this.battleFormat = params.battleFormat;
    this.arena = ARENAS.find((a) => a.id === params.arenaId) ?? ARENAS[0];
    this.seed = params.seed ?? Math.floor(Math.random() * 1_000_000_000);
    // Quick Match ranked always uses 1 minute; Solo/Private Rooms use configured 1m (60s) or 5m (300s)
    this.roundDurationMs =
      params.mode === 'quick_match'
        ? 60_000
        : params.roundDurationSec === 300
        ? 300_000
        : 60_000;
    this.engine = Engine.create({
      gravity: { x: 0, y: 1.45, scale: 0.001 },
    });

    for (const p of params.participants) {
      const weaponDef = p.roomWeapon ? ROOM_WEAPONS.find((w) => w.id === p.roomWeapon) : null;
      const equippedWeapon = getWeaponById(p.cosmetics.weaponId);
      this.vehicles.set(p.playerId, {
        init: p,
        blueprint: null,
        chassis: null,
        rider: null,
        headSensor: null,
        riderJoint: null,
        facing: 1,
        lanceAngle: 0,
        riderHp: 100,
        maxRiderHp: 100,
        chassisHp: 100,
        maxChassisHp: 100,
        boostEnergy: 100,
        boosting: false,
        jumpCooldownMs: 0,
        weaponCooldownMs: 0,
        weaponMaxCooldownMs: weaponDef ? weaponDef.cooldownSec * 1000 : 0,
        weaponStats: equippedWeapon.stats,
        weaponLengthScale: equippedWeapon.renderParams.lengthScale,
        weaponHeadScale: equippedWeapon.renderParams.headScale,
        shieldActiveMs: 0,
        magnetActiveMs: 0,
        slamArmed: false,
        input: { move: 0, boost: false, jump: false, lanceDir: 0, special: false },
        pendingJump: false,
        prevInputJump: false,
        pendingSpecial: false,
        prevInputSpecial: false,
        eliminated: false,
        roundWins: 0,
        lastHitAtMs: 0,
        headInvulnMs: 0,
        headFlashMs: 0,
        connected: p.connected ?? true,
        aiThinkTimerMs: 0,
      });
    }

    this.setupCollisionHandler();
    this.beginDrawPhase();
  }

  private setupCollisionHandler() {
    Events.on(this.engine, 'collisionStart', (ev) => {
      if (this.phase !== 'FIGHTING') return;
      const now = Date.now();

      for (const pair of ev.pairs) {
        const bodyA = pair.bodyA.parent ?? pair.bodyA;
        const bodyB = pair.bodyB.parent ?? pair.bodyB;

        if (bodyA.label === 'bounce_pad' || bodyB.label === 'bounce_pad') {
          const vehicleBody = bodyA.label === 'bounce_pad' ? bodyB : bodyA;
          const pid = this.bodyToPlayerId.get(vehicleBody.id);
          if (pid) {
            const v = this.vehicles.get(pid);
            if (v?.chassis && !v.eliminated) {
              Body.setVelocity(v.chassis, { x: v.chassis.velocity.x * 1.1, y: -11.5 });
              this.emitFx({
                kind: 'bounce',
                x: v.chassis.position.x,
                y: v.chassis.position.y + 18,
                color: '#10B981',
                intensity: 1,
              });
            }
          }
          continue;
        }

        const pidA = this.bodyToPlayerId.get(bodyA.id);
        const pidB = this.bodyToPlayerId.get(bodyB.id);
        if (!pidA || !pidB || pidA === pidB) continue;

        const vA = this.vehicles.get(pidA);
        const vB = this.vehicles.get(pidB);
        if (!vA || !vB || vA.eliminated || vB.eliminated) continue;
        if (this.battleFormat === 'teams' && vA.init.teamId === vB.init.teamId) continue;

        const relVx = (vA.chassis?.velocity.x ?? 0) - (vB.chassis?.velocity.x ?? 0);
        const relVy = (vA.chassis?.velocity.y ?? 0) - (vB.chassis?.velocity.y ?? 0);
        const impactSpeed = Math.hypot(relVx, relVy);
        if (impactSpeed < 1.6) continue;

        if (now - vA.lastHitAtMs > 170 || now - vB.lastHitAtMs > 170) {
          vA.lastHitAtMs = now;
          vB.lastHitAtMs = now;
          this.resolveVehicleClash(vA, vB, impactSpeed, pair.collision.supports[0]);
        }
      }
    });
  }

  private computeWeaponMatchup(attacker: WeaponStats, defender: WeaponStats): {
    dmgMult: number;
    knockbackMult: number;
  } {
    let dmgMult = attacker.damage;
    let knockbackMult = attacker.impactForce;

    // Rock-Paper-Scissors interactions:
    // Heavy Hammers crush Light Spears; Light Spears pierce Shields; Shields absorb Heavy Hammers
    if (attacker.specialEffect === 'heavy_crush' && defender.specialEffect === 'pierce_shield') {
      dmgMult *= 1.15;
      knockbackMult *= 1.22;
    } else if (attacker.specialEffect === 'pierce_shield' && defender.specialEffect === 'guard_absorb') {
      dmgMult *= 1.22;
      knockbackMult *= 1.1;
    } else if (attacker.specialEffect === 'heavy_crush' && defender.specialEffect === 'guard_absorb') {
      dmgMult *= 0.65;
      knockbackMult *= 0.65;
    } else if (defender.specialEffect === 'guard_absorb' && attacker.specialEffect !== 'pierce_shield') {
      dmgMult *= 0.88;
      knockbackMult *= 0.88;
    }

    return { dmgMult, knockbackMult };
  }

  private resolveVehicleClash(
    vA: InternalVehicle,
    vB: InternalVehicle,
    impactSpeed: number,
    contact?: { x: number; y: number }
  ) {
    // Body/rig/wheel collisions push and knock back, and trigger visual/audio clash sparks,
    // but NEVER reduce health (only weapon-to-HEAD hits reduce health!).
    const matchA = this.computeWeaponMatchup(vA.weaponStats, vB.weaponStats);
    const matchB = this.computeWeaponMatchup(vB.weaponStats, vA.weaponStats);

    if (vA.slamArmed && (vA.chassis?.velocity.y ?? 0) > 2) {
      vA.slamArmed = false;
      if (vB.chassis) {
        Body.applyForce(vB.chassis, vB.chassis.position, {
          x: Math.sign(vB.chassis.position.x - (vA.chassis?.position.x ?? 0)) * 0.045,
          y: -0.04,
        });
      }
    }
    if (vB.slamArmed && (vB.chassis?.velocity.y ?? 0) > 2) {
      vB.slamArmed = false;
      if (vA.chassis) {
        Body.applyForce(vA.chassis, vA.chassis.position, {
          x: Math.sign(vA.chassis.position.x - (vB.chassis?.position.x ?? 0)) * 0.045,
          y: -0.04,
        });
      }
    }

    if (vB.shieldActiveMs > 0 && vA.chassis) {
      Body.applyForce(vA.chassis, vA.chassis.position, {
        x: Math.sign(vA.chassis.position.x - (vB.chassis?.position.x ?? 0)) * 0.08,
        y: -0.05,
      });
    }
    if (vA.shieldActiveMs > 0 && vB.chassis) {
      Body.applyForce(vB.chassis, vB.chassis.position, {
        x: Math.sign(vB.chassis.position.x - (vA.chassis?.position.x ?? 0)) * 0.08,
        y: -0.05,
      });
    }

    // Physical knockback impulse on body clash
    if (vA.chassis && vB.chassis) {
      const pushDir = Math.sign(vB.chassis.position.x - vA.chassis.position.x) || 1;
      const forceScale = Math.min(1.6, 0.7 + impactSpeed / 10);
      Body.applyForce(vB.chassis, vB.chassis.position, {
        x: pushDir * 0.018 * matchA.knockbackMult * forceScale,
        y: -0.008 * matchA.knockbackMult,
      });
      Body.applyForce(vA.chassis, vA.chassis.position, {
        x: -pushDir * 0.018 * matchB.knockbackMult * forceScale,
        y: -0.008 * matchB.knockbackMult,
      });
    }

    const fxX = contact?.x ?? ((vA.chassis?.position.x ?? 0) + (vB.chassis?.position.x ?? 0)) / 2;
    const fxY = contact?.y ?? ((vA.chassis?.position.y ?? 0) + (vB.chassis?.position.y ?? 0)) / 2;

    this.emitFx({
      kind: 'impact',
      x: fxX,
      y: fxY,
      color: impactSpeed > 7 ? '#D99B26' : '#A8A29E',
      intensity: Math.min(1.3, impactSpeed / 7),
    });
  }

  private checkIntegrityElimination(v: InternalVehicle) {
    if (v.eliminated) return;
    if (v.riderHp <= 0) {
      this.eliminateVehicle(v, 'Head Strike KO!');
    }
  }

  private eliminateVehicle(v: InternalVehicle, reason: string) {
    if (v.eliminated) return;
    v.eliminated = true;
    v.boosting = false;
    v.eliminationReason = reason;
    if (v.riderJoint) {
      World.remove(this.engine.world, v.riderJoint);
      v.riderJoint = null;
    }
    if (v.rider) {
      Body.setVelocity(v.rider, {
        x: (Math.random() - 0.5) * 9,
        y: -9.5,
      });
      Body.setAngularVelocity(v.rider, (Math.random() - 0.5) * 0.35);
    }
    if (v.chassis) {
      this.emitFx({
        kind: 'ko',
        x: v.chassis.position.x,
        y: v.chassis.position.y - 20,
        color: '#E85D2A',
        intensity: 1.8,
        label: reason,
      });
    }
  }

  private setPhase(next: MatchPhase) {
    this.phase = next;
    log('PHASE', `Phase -> ${next}`, {
      matchId: this.matchId,
      mode: this.mode,
      roundIndex: this.roundIndex,
    });
  }

  public beginDrawPhase() {
    this.setPhase('DRAWING');
    this.phaseRemainingMs = DRAW_PHASE_MS;
    this.physicsAccumulatorMs = 0;
    this.slowMoRemainingMs = 0;
    this.suddenDeath = false;
    this.activePickup = null;
    this.pickupSpawnedThisRound = false;
    this.roundWinnerIds = [];
    this.koSummary = '';
    World.clear(this.engine.world, false);
    this.bodyToPlayerId.clear();

    for (const v of this.vehicles.values()) {
      v.blueprint = null;
      v.chassis = null;
      v.rider = null;
      v.headSensor = null;
      v.riderJoint = null;
      v.lanceAngle = 0;
      v.eliminated = false;
      v.eliminationReason = undefined;
      v.boostEnergy = 100;
      v.boosting = false;
      v.jumpCooldownMs = 0;
      v.weaponCooldownMs = 0;
      v.shieldActiveMs = 0;
      v.magnetActiveMs = 0;
      v.slamArmed = false;
      v.headInvulnMs = 0;
      v.headFlashMs = 0;
      v.input = { move: 0, boost: false, jump: false, lanceDir: 0, special: false };
      v.pendingJump = false;
      v.prevInputJump = false;
      v.pendingSpecial = false;
      v.prevInputSpecial = false;

      if (v.init.isBot) {
        v.blueprint = this.generateBotBlueprint(v.init.botArchetype);
      }
    }
  }

  private generateBotBlueprint(archetype?: PresetKind): DrawnBlueprint {
    const choices: PresetKind[] = ['wheel', 'wedge', 'sled', 'spiker', 'hammer'];
    const pick = archetype ?? choices[Math.floor(Math.random() * choices.length)];
    const base = getPresetStrokes(pick);
    const jittered = base.map((stroke) =>
      stroke.map((pt) => ({
        x: Math.max(0.1, Math.min(0.9, pt.x + (Math.random() - 0.5) * 0.03)),
        y: Math.max(0.1, Math.min(0.9, pt.y + (Math.random() - 0.5) * 0.03)),
      }))
    );
    return compileDrawnBlueprint(jittered);
  }

  public submitBlueprint(playerId: string, blueprint: DrawnBlueprint) {
    const v = this.vehicles.get(playerId);
    if (!v || this.phase !== 'DRAWING') return;
    v.blueprint = blueprint;

    const allHumansSubmitted = Array.from(this.vehicles.values())
      .filter((item) => !item.init.isBot)
      .every((item) => item.blueprint !== null);

    if (allHumansSubmitted) {
      this.spawnArenaAndVehicles();
    }
  }

  /**
   * Receives a PlayerInputState from InputManager (local) or WebRTC DataChannel (remote 30Hz).
   * Edge-latches special pulses so brief taps are never missed between physics steps.
   */
  public setPlayerInput(playerId: string, input: PlayerInputState) {
    const v = this.vehicles.get(playerId);
    if (!v) return;
    if (input.jump && !v.prevInputJump) {
      v.pendingJump = true;
    }
    v.prevInputJump = Boolean(input.jump);
    if (input.special && !v.prevInputSpecial) {
      v.pendingSpecial = true;
    }
    v.prevInputSpecial = input.special;
    v.input = {
      move: Math.max(-1, Math.min(1, Number(input.move) || 0)),
      boost: Boolean(input.boost),
      jump: Boolean(input.jump),
      lanceDir: Math.max(-1, Math.min(1, Number(input.lanceDir) || 0)),
      special: Boolean(input.special),
    };
  }

  public setPlayerConnection(playerId: string, connected: boolean, reconnectRemainingSec?: number) {
    const v = this.vehicles.get(playerId);
    if (!v) return;
    v.connected = connected;
    v.reconnectRemainingSec = reconnectRemainingSec;
  }

  private spawnArenaAndVehicles() {
    World.clear(this.engine.world, false);
    this.bodyToPlayerId.clear();
    this.platformBodies = [];

    for (const plat of this.arena.platforms) {
      const body = Bodies.rectangle(plat.x, plat.y, plat.width, plat.height, {
        isStatic: true,
        angle: plat.angle ?? 0,
        friction: plat.isBumper ? 0.1 : 0.32,
        restitution: plat.isBumper ? 0.85 : plat.isBouncePad ? 1.15 : 0.16,
        label: plat.isBouncePad ? 'bounce_pad' : plat.isBumper ? 'bumper' : 'deck',
      });
      this.platformBodies.push(body);
    }
    World.add(this.engine.world, this.platformBodies);

    const findPlatformSurfaceY = (x: number, fallbackY: number): number => {
      let bestY = Infinity;
      for (const plat of this.arena.platforms) {
        if (plat.isBumper || plat.isBouncePad) continue;
        const halfW = (plat.width / 2) * Math.cos(plat.angle ?? 0);
        if (x >= plat.x - halfW && x <= plat.x + halfW) {
          const ang = plat.angle ?? 0;
          const surfaceY =
            plat.y +
            (x - plat.x) * Math.tan(ang) -
            (plat.height / 2) / Math.max(0.5, Math.cos(ang));
          if (surfaceY < bestY) bestY = surfaceY;
        }
      }
      return Number.isFinite(bestY) ? bestY : fallbackY + 45;
    };

    this.activePickup = null;
    this.pickupSpawnedThisRound = false;
    this.pickupLandingY = findPlatformSurfaceY(0, 150) - 24;

    const list = Array.from(this.vehicles.values());
    list.forEach((v, idx) => {
      if (!v.blueprint) {
        v.blueprint = compileDrawnBlueprint(getPresetStrokes('wheel'));
      }
      const spawn = this.arena.spawnPoints[idx % this.arena.spawnPoints.length];
      v.facing = spawn.facing;
      v.lanceAngle = 0;
      v.maxChassisHp = v.blueprint.stats.armorHp;
      v.chassisHp = v.maxChassisHp;
      v.maxRiderHp = 100;
      v.riderHp = 100;
      v.eliminated = false;
      v.boostEnergy = 100;
      v.boosting = false;
      v.jumpCooldownMs = 0;
      v.pendingJump = false;
      v.prevInputJump = false;
      v.weaponCooldownMs = 0;
      v.headInvulnMs = 0;
      v.headFlashMs = 0;
      v.aiThinkTimerMs = v.init.isBot ? 450 : 0;

      const scaleW = 128;
      const scaleH = 104;
      const clampedRestitution = Math.min(0.14, v.blueprint.stats.restitution);
      const parts: Matter.Body[] = v.blueprint.hullParts.map((poly) => {
        const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length;
        const cy = poly.reduce((s, p) => s + p.y, 0) / poly.length;
        const partX = spawn.x + cx * scaleW;
        const partY = spawn.y + cy * scaleH;
        const verts = poly.map((p) => ({
          x: spawn.x + p.x * scaleW,
          y: spawn.y + p.y * scaleH,
        }));
        return Bodies.fromVertices(partX, partY, [verts], {
          friction: v.blueprint!.stats.friction,
          restitution: clampedRestitution,
        });
      });

      const validParts = parts.filter((p) => p && p.area > 1);
      const chassis =
        validParts.length > 0
          ? Body.create({
              parts: validParts,
              friction: v.blueprint.stats.friction,
              restitution: clampedRestitution,
              frictionAir: 0.024,
              label: `chassis_${v.init.playerId}`,
            })
          : Bodies.rectangle(spawn.x, spawn.y, 76, 42, {
              friction: v.blueprint.stats.friction,
              restitution: clampedRestitution,
              frictionAir: 0.024,
            });

      const weaponMassMult = 0.85 + v.weaponStats.weight * 0.15;
      const effectiveMass = v.blueprint.stats.mass * weaponMassMult;
      Body.setMass(chassis, effectiveMass);
      Body.setInertia(chassis, effectiveMass * 1250);
      Body.setPosition(chassis, { x: spawn.x, y: spawn.y });
      Body.setAngle(chassis, 0);

      // Rest chassis cleanly on platform top so nothing drops or hops when fight begins
      const bottomOffset = Math.max(16, chassis.bounds.max.y - chassis.position.y);
      const surfaceY = findPlatformSurfaceY(spawn.x, spawn.y);
      const groundedY = surfaceY - bottomOffset - 0.5;
      Body.setPosition(chassis, { x: spawn.x, y: groundedY });
      Body.setVelocity(chassis, { x: 0, y: 0 });
      Body.setAngularVelocity(chassis, 0);

      const rider = Bodies.circle(spawn.x, groundedY - 36, 16, {
        mass: 0.55,
        friction: 0.28,
        restitution: 0.12,
        frictionAir: 0.028,
        collisionFilter: { group: -(idx + 10) },
        label: `rider_${v.init.playerId}`,
      });
      Body.setVelocity(rider, { x: 0, y: 0 });
      Body.setAngularVelocity(rider, 0);

      const headSensor = Bodies.circle(spawn.x, groundedY - 38, HEAD_SENSOR_RADIUS, {
        isSensor: true,
        isStatic: false,
        frictionAir: 0,
        collisionFilter: { group: -(idx + 10) },
        label: `head_sensor_${v.init.playerId}`,
      });
      Body.setVelocity(headSensor, { x: 0, y: 0 });

      chassis.collisionFilter.group = -(idx + 10);

      const joint = Constraint.create({
        bodyA: chassis,
        pointA: { x: 0, y: -14 },
        bodyB: rider,
        pointB: { x: 0, y: 12 },
        stiffness: 0.52,
        damping: 0.2,
        length: 22,
      });

      v.chassis = chassis;
      v.rider = rider;
      v.headSensor = headSensor;
      v.riderJoint = joint;

      this.bodyToPlayerId.set(chassis.id, v.init.playerId);
      this.bodyToPlayerId.set(rider.id, v.init.playerId);

      World.add(this.engine.world, [chassis, rider, headSensor, joint]);
    });

    this.setPhase('COUNTDOWN');
    this.phaseRemainingMs = COUNTDOWN_MS;
    this.physicsAccumulatorMs = 0;
    this.slowMoRemainingMs = 0;
  }

  private syncHeadSensors() {
    for (const v of this.vehicles.values()) {
      if (v.rider && v.headSensor) {
        Body.setPosition(v.headSensor, {
          x: v.rider.position.x,
          y: v.rider.position.y - 2,
        });
        Body.setVelocity(v.headSensor, v.rider.velocity);
      }
    }
  }

  public step(dtMs: number) {
    const clampedMs = Math.min(Math.max(0, dtMs), FIXED_STEP_MS * MAX_STEPS_PER_FRAME);

    if (this.phase === 'DRAWING') {
      this.phaseRemainingMs -= clampedMs;
      if (this.phaseRemainingMs <= 0) {
        this.spawnArenaAndVehicles();
      }
      return;
    }

    if (this.phase === 'COUNTDOWN') {
      this.phaseRemainingMs -= clampedMs;
      // Keep physics bodies completely frozen during 3-2-1 countdown
      for (const v of this.vehicles.values()) {
        if (v.chassis) {
          Body.setVelocity(v.chassis, { x: 0, y: 0 });
          Body.setAngularVelocity(v.chassis, 0);
        }
        if (v.rider) {
          Body.setVelocity(v.rider, { x: 0, y: 0 });
          Body.setAngularVelocity(v.rider, 0);
        }
      }
      this.syncHeadSensors();
      if (this.phaseRemainingMs <= 0) {
        this.physicsAccumulatorMs = 0;
        this.slowMoRemainingMs = 0;
        this.suddenDeath = false;
        this.setPhase('FIGHTING');
        this.phaseRemainingMs = this.roundDurationMs;
      }
      return;
    }

    if (this.phase === 'FIGHTING') {
      let timeScale = 1;
      if (this.slowMoRemainingMs > 0) {
        this.slowMoRemainingMs = Math.max(0, this.slowMoRemainingMs - clampedMs);
        timeScale = 0.34;
      }
      const scaledMs = clampedMs * timeScale;
      this.phaseRemainingMs -= scaledMs;
      this.physicsAccumulatorMs = Math.min(
        this.physicsAccumulatorMs + scaledMs,
        FIXED_STEP_MS * MAX_STEPS_PER_FRAME
      );
      let steps = 0;
      while (this.physicsAccumulatorMs >= FIXED_STEP_MS && steps < MAX_STEPS_PER_FRAME) {
        this.updateActiveFighters(FIXED_STEP_MS);
        Engine.update(this.engine, FIXED_STEP_MS);
        this.syncHeadSensors();
        this.physicsAccumulatorMs -= FIXED_STEP_MS;
        steps += 1;
        this.checkLanceAndBounds(FIXED_STEP_MS);
        this.updateHealthPickup(FIXED_STEP_MS);
        this.evaluateRoundOutcome();
        if (this.phase !== 'FIGHTING') break;
      }
      return;
    }

    if (this.phase === 'ROUND_END') {
      this.phaseRemainingMs -= clampedMs;
      this.physicsAccumulatorMs = Math.min(
        this.physicsAccumulatorMs + clampedMs,
        FIXED_STEP_MS * MAX_STEPS_PER_FRAME
      );
      let steps = 0;
      while (this.physicsAccumulatorMs >= FIXED_STEP_MS && steps < MAX_STEPS_PER_FRAME) {
        Engine.update(this.engine, FIXED_STEP_MS);
        this.physicsAccumulatorMs -= FIXED_STEP_MS;
        steps += 1;
      }
      if (this.phaseRemainingMs <= 0) {
        if (this.matchWinnerIds.length > 0) {
          this.setPhase('MATCH_OVER');
          this.phaseRemainingMs = 0;
        } else {
          this.roundIndex += 1;
          this.beginDrawPhase();
        }
      }
    }
  }

  private updateActiveFighters(dtMs: number) {
    const list = Array.from(this.vehicles.values());

    for (const v of list) {
      if (v.eliminated || !v.chassis || !v.rider) continue;

      if (v.jumpCooldownMs > 0) v.jumpCooldownMs = Math.max(0, v.jumpCooldownMs - dtMs);
      if (v.weaponCooldownMs > 0) v.weaponCooldownMs = Math.max(0, v.weaponCooldownMs - dtMs);
      if (v.shieldActiveMs > 0) v.shieldActiveMs = Math.max(0, v.shieldActiveMs - dtMs);
      if (v.magnetActiveMs > 0) {
        v.magnetActiveMs = Math.max(0, v.magnetActiveMs - dtMs);
        this.applyMagnetPull(v, list);
      }

      const nearest = this.findNearestEnemy(v, list);
      if (nearest?.chassis) {
        const dx = nearest.chassis.position.x - v.chassis.position.x;
        if (Math.abs(dx) > 28) {
          v.facing = dx >= 0 ? 1 : -1;
        }
      }

      // Bots generate the exact same PlayerInputState structure as human players
      if (v.init.isBot) {
        this.updateBotInput(v, nearest, dtMs);
      }

      // Shared control application path for humans, remote peers, and bots
      this.applyFighterControls(v, nearest, list, dtMs);
    }
  }

  private applyFighterControls(
    v: InternalVehicle,
    nearest: InternalVehicle | null,
    all: InternalVehicle[],
    dtMs: number
  ) {
    if (!v.chassis || !v.rider) return;
    const input = v.input;
    const dtSec = dtMs / 1000;
    const speedFactor = (v.blueprint?.stats.speedRating ?? 5) / 10;

    // 1. Special Weapon (Private Room Mode only)
    const wantSpecial = v.pendingSpecial || input.special;
    v.pendingSpecial = false;
    if (wantSpecial && v.init.roomWeapon && v.weaponCooldownMs <= 0) {
      this.triggerRoomWeapon(v, nearest, all);
    }

    // 1b. Manual Jump (1.2s cooldown, grounded only — no double jump, never automatic)
    const wantJump = v.pendingJump;
    v.pendingJump = false;
    if (wantJump && v.jumpCooldownMs <= 0 && this.isVehicleGrounded(v)) {
      v.jumpCooldownMs = 1200;
      Body.setVelocity(v.chassis, {
        x: v.chassis.velocity.x,
        y: -9.2,
      });
      Body.setVelocity(v.rider, {
        x: v.rider.velocity.x,
        y: -8.6,
      });
      this.emitFx({
        kind: 'bounce',
        x: v.chassis.position.x,
        y: v.chassis.position.y + 18,
        color: '#D99B26',
        intensity: 0.6,
      });
    }

    // 2. Manual Left / Right Drive (ZERO auto-forward drive; stays still when released)
    const hasMoveInput = Math.abs(input.move) > 0.04;
    const weaponSpeedMult = v.weaponStats.speedModifier;
    if (hasMoveInput) {
      const moveMaxSpeed = (6.2 + speedFactor * 2.2) * weaponSpeedMult;
      if (Math.sign(input.move) * v.chassis.velocity.x < moveMaxSpeed) {
        Body.applyForce(v.chassis, v.chassis.position, {
          x: input.move * (0.0036 + speedFactor * 0.0014) * weaponSpeedMult * v.chassis.mass,
          y: 0,
        });
      }
    }

    // 3. Boost (short horizontal forward dash while held, limited by regenerating energy bar)
    if (input.boost && v.boostEnergy > 3) {
      v.boosting = true;
      v.boostEnergy = Math.max(0, v.boostEnergy - dtMs * 0.052);
      const boostCap = 10.6 + speedFactor * 1.4;
      if (v.facing * v.chassis.velocity.x < boostCap) {
        Body.applyForce(v.chassis, v.chassis.position, {
          x: v.facing * 0.0056 * v.chassis.mass,
          y: 0,
        });
      }
    } else {
      v.boosting = false;
      v.boostEnergy = Math.min(100, v.boostEnergy + dtMs * 0.026);
    }

    // Gentle damping when no move/boost input is held so rig stops cleanly without sliding forever
    if (!hasMoveInput && !v.boosting) {
      const dampedVx = Math.abs(v.chassis.velocity.x) < 0.06 ? 0 : v.chassis.velocity.x * 0.86;
      Body.setVelocity(v.chassis, {
        x: dampedVx,
        y: v.chassis.velocity.y,
      });
    }

    // 4. Stability caps: prevent flipping, hopping, or runaway spinning
    const maxVx = 11.5;
    const maxVy = 13.0;
    const clampedVx = Math.max(-maxVx, Math.min(maxVx, v.chassis.velocity.x));
    const clampedVy = Math.max(-10.0, Math.min(maxVy, v.chassis.velocity.y));
    if (clampedVx !== v.chassis.velocity.x || clampedVy !== v.chassis.velocity.y) {
      Body.setVelocity(v.chassis, { x: clampedVx, y: clampedVy });
    }

    const normAngle = Math.atan2(Math.sin(v.chassis.angle), Math.cos(v.chassis.angle));
    const maxTilt = 0.46;
    if (Math.abs(normAngle) > maxTilt) {
      Body.setAngle(v.chassis, Math.sign(normAngle) * maxTilt);
    }
    const targetTilt = hasMoveInput ? input.move * 0.12 : 0;
    const tiltErr = normAngle - targetTilt;
    const nextAngVel = Math.max(
      -0.055,
      Math.min(0.055, v.chassis.angularVelocity * 0.78 - tiltErr * 0.045)
    );
    Body.setAngularVelocity(v.chassis, nextAngVel);

    // 5. Lance Angle (-0.85..+0.85 radians)
    if (Math.abs(input.lanceDir) > 0.04) {
      v.lanceAngle = Math.max(
        -0.85,
        Math.min(0.85, v.lanceAngle + input.lanceDir * 2.5 * dtSec)
      );
    }

    // 6. Rider Upright Stabilization above chassis
    const targetRiderX = v.chassis.position.x - v.facing * 4;
    const targetRiderY = v.chassis.position.y - 36;
    Body.applyForce(v.rider, v.rider.position, {
      x: (targetRiderX - v.rider.position.x) * 0.00055,
      y: (targetRiderY - v.rider.position.y) * 0.00045,
    });
  }

  private isVehicleGrounded(v: InternalVehicle): boolean {
    if (!v.chassis) return false;
    if (Math.abs(v.chassis.velocity.y) > 3.2) return false;
    const b = v.chassis.bounds;
    const hits = Query.region(this.platformBodies, {
      min: { x: b.min.x + 2, y: b.max.y - 6 },
      max: { x: b.max.x - 2, y: b.max.y + 12 },
    });
    return hits.length > 0;
  }

  private findNearestEnemy(self: InternalVehicle, all: InternalVehicle[]): InternalVehicle | null {
    let best: InternalVehicle | null = null;
    let bestDist = Infinity;
    for (const other of all) {
      if (other.init.playerId === self.init.playerId || other.eliminated || !other.chassis || !self.chassis) {
        continue;
      }
      if (this.battleFormat === 'teams' && other.init.teamId === self.init.teamId) {
        continue;
      }
      const d = Math.hypot(
        other.chassis.position.x - self.chassis.position.x,
        other.chassis.position.y - self.chassis.position.y
      );
      if (d < bestDist) {
        bestDist = d;
        best = other;
      }
    }
    return best;
  }

  private updateBotInput(bot: InternalVehicle, target: InternalVehicle | null, dtMs: number) {
    bot.aiThinkTimerMs -= dtMs;
    if (bot.aiThinkTimerMs > 0 || !bot.chassis) return;

    const diff = bot.init.botDifficulty ?? 'easy';
    if (diff === 'easy') {
      bot.aiThinkTimerMs = 460 + Math.random() * 240; // 460..700 ms slow reaction
    } else if (diff === 'normal') {
      bot.aiThinkTimerMs = 340 + Math.random() * 160; // 340..500 ms
    } else {
      bot.aiThinkTimerMs = 200 + Math.random() * 120; // 200..320 ms
    }

    const dx = target?.chassis ? target.chassis.position.x - bot.chassis.position.x : 0;
    const distToEnemy = target?.chassis
      ? Math.hypot(dx, target.chassis.position.y - bot.chassis.position.y)
      : 400;
    const dirToEnemy = dx >= 0 ? 1 : -1;

    // Movement with human-like mistakes & hesitation (never perfectly counters player)
    let move = 0;
    let chasePickup = false;
    if (this.activePickup && (this.activePickup.state !== 'falling' || this.activePickup.y > 10)) {
      const distBotToPickup = Math.abs(this.activePickup.x - bot.chassis.position.x);
      const distEnemyToPickup = target?.chassis
        ? Math.abs(this.activePickup.x - target.chassis.position.x)
        : 9999;
      const injured = bot.riderHp < bot.maxRiderHp;
      if (diff === 'easy') {
        chasePickup = distBotToPickup < distEnemyToPickup && Math.random() < 0.55;
      } else if (diff === 'normal') {
        chasePickup = (distBotToPickup <= distEnemyToPickup + 40 || injured) && Math.random() < 0.82;
      } else {
        chasePickup = distBotToPickup <= distEnemyToPickup + 50 || bot.riderHp <= bot.maxRiderHp * 0.75;
      }
    }

    if (chasePickup && this.activePickup) {
      const dxPickup = this.activePickup.x - bot.chassis.position.x;
      move = Math.abs(dxPickup) < 12 ? 0 : Math.sign(dxPickup) * (diff === 'hard' ? 0.98 : 0.82);
    } else if (diff === 'easy') {
      const roll = Math.random();
      if (roll < 0.34) {
        // Frequent pause / hesitation
        move = 0;
      } else if (roll < 0.48) {
        // Occasional clumsy step back
        move = -dirToEnemy * 0.45;
      } else if (distToEnemy > 75) {
        move = dirToEnemy * 0.62;
      }
    } else if (diff === 'normal') {
      const roll = Math.random();
      if (roll < 0.16) {
        move = 0;
      } else if (distToEnemy < 90 && roll < 0.35) {
        move = -dirToEnemy * 0.55;
      } else {
        move = dirToEnemy * 0.82;
      }
    } else {
      if (distToEnemy < 75 && Math.random() < 0.25) {
        move = -dirToEnemy * 0.7;
      } else {
        move = dirToEnemy * 0.96;
      }
    }

    // Boost only occasionally on Easy/Normal
    let boost = false;
    if (chasePickup && this.activePickup && Math.abs(this.activePickup.x - bot.chassis.position.x) > 130) {
      boost = diff !== 'easy' && bot.boostEnergy > 35 && Math.random() < (diff === 'hard' ? 0.65 : 0.3);
    } else if (diff === 'easy') {
      boost = distToEnemy > 130 && distToEnemy < 270 && bot.boostEnergy > 48 && Math.random() < 0.14;
    } else if (diff === 'normal') {
      boost = distToEnemy > 110 && distToEnemy < 270 && bot.boostEnergy > 36 && Math.random() < 0.32;
    } else {
      boost = distToEnemy > 90 && distToEnemy < 280 && bot.boostEnergy > 24 && Math.random() < 0.55;
    }

    // Aim lance toward opponent's HEAD hitbox depending on difficulty
    let lanceDir = 0;
    const targetHead = target?.headSensor ?? target?.rider;
    const myShoulder = bot.rider;
    if (targetHead && myShoulder) {
      const dxHead = Math.abs(targetHead.position.x - myShoulder.position.x);
      const dyHead = targetHead.position.y - myShoulder.position.y;
      const desiredAngle = Math.max(-0.82, Math.min(0.82, Math.atan2(dyHead, Math.max(40, dxHead))));
      const angleDiff = desiredAngle - bot.lanceAngle;
      if (diff === 'easy') {
        const aimRoll = Math.random();
        if (aimRoll < 0.45) {
          lanceDir = aimRoll < 0.22 ? -0.55 : 0.55; // Wrong/random aim mistake
        } else if (angleDiff < -0.18) {
          lanceDir = -0.45;
        } else if (angleDiff > 0.18) {
          lanceDir = 0.45;
        }
      } else if (diff === 'normal') {
        if (Math.random() < 0.2) {
          lanceDir = Math.random() < 0.5 ? -0.45 : 0.45;
        } else if (angleDiff < -0.09) {
          lanceDir = -0.68;
        } else if (angleDiff > 0.09) {
          lanceDir = 0.68;
        }
      } else {
        if (angleDiff < -0.04) lanceDir = -0.9;
        else if (angleDiff > 0.04) lanceDir = 0.9;
      }
    }

    const special = Boolean(
      bot.init.roomWeapon &&
        bot.weaponCooldownMs <= 0 &&
        distToEnemy < 240 &&
        Math.random() < (diff === 'easy' ? 0.3 : 0.65)
    );

    const jump = Boolean(
      bot.jumpCooldownMs <= 0 &&
        this.isVehicleGrounded(bot) &&
        distToEnemy > 75 &&
        distToEnemy < 240 &&
        Math.random() < (diff === 'hard' ? 0.055 : diff === 'normal' ? 0.025 : 0.012)
    );

    this.setPlayerInput(bot.init.playerId, {
      move,
      boost,
      jump,
      lanceDir,
      special,
    });
  }

  private triggerRoomWeapon(v: InternalVehicle, target: InternalVehicle | null, all: InternalVehicle[]) {
    if (!v.chassis || !v.init.roomWeapon) return;
    v.weaponCooldownMs = v.weaponMaxCooldownMs;
    const weapon = v.init.roomWeapon;

    if (weapon === 'thunder_lance') {
      Body.setVelocity(v.chassis, {
        x: v.facing * 14.5,
        y: Math.min(v.chassis.velocity.y, -2.2),
      });
      if (target?.chassis && !target.eliminated) {
        const d = Math.hypot(target.chassis.position.x - v.chassis.position.x, target.chassis.position.y - v.chassis.position.y);
        if (d < 235) {
          Body.applyForce(target.chassis, target.chassis.position, {
            x: v.facing * 0.085,
            y: -0.055,
          });
        }
      }
      this.emitFx({
        kind: 'thunder',
        x: v.chassis.position.x,
        y: v.chassis.position.y,
        targetX: target?.chassis?.position.x ?? v.chassis.position.x + v.facing * 180,
        targetY: target?.chassis?.position.y ?? v.chassis.position.y,
        color: '#38BDF8',
        intensity: 1.5,
      });
    } else if (weapon === 'hammer_wheel') {
      Body.setAngularVelocity(v.chassis, v.facing * 0.45);
      for (const other of all) {
        if (other.init.playerId === v.init.playerId || other.eliminated || !other.chassis) continue;
        if (this.battleFormat === 'teams' && other.init.teamId === v.init.teamId) continue;
        const dx = other.chassis.position.x - v.chassis.position.x;
        const dy = other.chassis.position.y - v.chassis.position.y;
        const d = Math.hypot(dx, dy);
        if (d < 195) {
          const dirX = dx / Math.max(1, d);
          Body.setVelocity(other.chassis, { x: dirX * 12, y: -9.2 });
        }
      }
      this.emitFx({
        kind: 'hammer',
        x: v.chassis.position.x,
        y: v.chassis.position.y,
        color: '#F59E0B',
        intensity: 1.6,
      });
    } else if (weapon === 'shield_dome') {
      v.shieldActiveMs = 2600;
      this.emitFx({
        kind: 'shield',
        x: v.chassis.position.x,
        y: v.chassis.position.y,
        color: '#10B981',
        intensity: 1.2,
      });
    } else if (weapon === 'magnet_ram') {
      v.magnetActiveMs = 1200;
      this.emitFx({
        kind: 'magnet',
        x: v.chassis.position.x,
        y: v.chassis.position.y,
        color: '#A855F7',
        intensity: 1.4,
      });
    } else if (weapon === 'bounce_boots') {
      v.slamArmed = true;
      Body.setVelocity(v.chassis, {
        x: v.chassis.velocity.x + v.facing * 5.5,
        y: -13.2,
      });
      this.emitFx({
        kind: 'bounce',
        x: v.chassis.position.x,
        y: v.chassis.position.y + 12,
        color: '#E85D2A',
        intensity: 1.3,
      });
    }
  }

  private applyMagnetPull(source: InternalVehicle, all: InternalVehicle[]) {
    if (!source.chassis) return;
    for (const other of all) {
      if (other.init.playerId === source.init.playerId || other.eliminated || !other.chassis) continue;
      if (this.battleFormat === 'teams' && other.init.teamId === source.init.teamId) continue;
      const dx = source.chassis.position.x - other.chassis.position.x;
      const dy = source.chassis.position.y - other.chassis.position.y;
      const d = Math.hypot(dx, dy);
      if (d > 25 && d < 350) {
        Body.applyForce(other.chassis, other.chassis.position, {
          x: (dx / d) * 0.0085 * other.chassis.mass,
          y: (dy / d) * 0.006 * other.chassis.mass,
        });
        Body.setAngularVelocity(other.chassis, other.chassis.angularVelocity + 0.04);
      }
    }
  }

  private computeWeaponHitZone(v: InternalVehicle): {
    startX: number;
    startY: number;
    tipX: number;
    tipY: number;
    hitRadius: number;
  } {
    const rx = v.rider?.position.x ?? v.chassis?.position.x ?? 0;
    const ry = v.rider?.position.y ?? (v.chassis?.position.y ?? 0) - 36;
    const cAngle = v.chassis?.angle ?? 0;
    const worldAngle = v.facing === 1 ? v.lanceAngle + cAngle * 0.25 : Math.PI - v.lanceAngle + cAngle * 0.25;
    const startReach = 28 * v.weaponLengthScale;
    const reach = 58 * v.weaponLengthScale;
    return {
      startX: rx + Math.cos(worldAngle) * startReach,
      startY: ry + Math.sin(worldAngle) * startReach,
      tipX: rx + Math.cos(worldAngle) * reach,
      tipY: ry + Math.sin(worldAngle) * reach,
      hitRadius: 9 * v.weaponHeadScale,
    };
  }

  private computeLanceTip(v: InternalVehicle): { x: number; y: number } {
    const zone = this.computeWeaponHitZone(v);
    return { x: zone.tipX, y: zone.tipY };
  }

  private checkLanceAndBounds(dtMs: number) {
    const list = Array.from(this.vehicles.values());

    for (const v of list) {
      if (v.headInvulnMs > 0) v.headInvulnMs = Math.max(0, v.headInvulnMs - dtMs);
      if (v.headFlashMs > 0) v.headFlashMs = Math.max(0, v.headFlashMs - dtMs);
    }

    for (const v of list) {
      if (v.eliminated || !v.chassis || !v.rider) continue;

      if (
        v.chassis.position.y > this.arena.fallY ||
        v.rider.position.y > this.arena.fallY + 30 ||
        Math.abs(v.chassis.position.x) > this.arena.worldWidth / 2 + 130
      ) {
        this.eliminateVehicle(v, 'Ring Out!');
        continue;
      }

      const zone = this.computeWeaponHitZone(v);

      for (const other of list) {
        if (other.init.playerId === v.init.playerId || other.eliminated || !other.rider || !other.chassis) continue;
        if (this.battleFormat === 'teams' && other.init.teamId === v.init.teamId) continue;
        if (other.headInvulnMs > 0) continue;

        const headPos = other.headSensor?.position ?? { x: other.rider.position.x, y: other.rider.position.y - 2 };
        const seg = pointToSegmentDist(
          headPos.x,
          headPos.y,
          zone.startX,
          zone.startY,
          zone.tipX,
          zone.tipY
        );

        if (seg.dist > HEAD_SENSOR_RADIUS + zone.hitRadius) continue;

        // Relative velocity check (slow touches do nothing)
        const relVx = v.chassis.velocity.x - other.chassis.velocity.x;
        const relVy = v.chassis.velocity.y - other.chassis.velocity.y;
        const swingSpeed = Math.abs(v.input.lanceDir) * 1.6;
        const relSpeed = Math.hypot(relVx, relVy) + swingSpeed;
        if (relSpeed < MIN_HEAD_HIT_REL_SPEED) continue;

        const matchup = this.computeWeaponMatchup(v.weaponStats, other.weaponStats);
        const impactFactor = Math.max(0.55, Math.min(2.25, relSpeed / 5.2));
        let dmg = Math.max(4, Math.round(18 * matchup.dmgMult * impactFactor));

        // Defensive weapon / shield head block (only if stats allow it)
        const attackerInFront = Math.sign(v.chassis.position.x - other.chassis.position.x) === other.facing;
        let blockedByShield = false;
        if (other.shieldActiveMs > 0) {
          dmg = Math.round(dmg * 0.15);
          blockedByShield = true;
        } else if (
          other.weaponStats.blocksHead &&
          v.weaponStats.specialEffect !== 'pierce_shield' &&
          attackerInFront &&
          Math.abs(other.lanceAngle) < 0.65
        ) {
          const reduction = other.weaponStats.blockReduction ?? 0.65;
          dmg = Math.max(2, Math.round(dmg * (1 - reduction)));
          blockedByShield = true;
        }

        // Apply 0.4s invulnerability window & head flash
        other.headInvulnMs = HEAD_INVULN_MS;
        other.headFlashMs = 260;
        other.riderHp = Math.max(0, other.riderHp - dmg);

        Body.applyForce(other.rider, other.rider.position, {
          x: v.facing * 0.036 * matchup.knockbackMult,
          y: -0.025 * matchup.knockbackMult,
        });
        Body.applyForce(other.chassis, other.chassis.position, {
          x: v.facing * 0.022 * matchup.knockbackMult,
          y: -0.01,
        });

        if (blockedByShield) {
          this.emitFx({
            kind: 'shield',
            x: seg.cx,
            y: seg.cy,
            color: '#10B981',
            intensity: 1.0,
            label: `BLOCKED! -${dmg}`,
            damage: dmg,
          });
        } else {
          this.emitFx({
            kind: 'head_hit',
            x: headPos.x,
            y: headPos.y - 10,
            targetX: zone.tipX,
            targetY: zone.tipY,
            color: '#EF4444',
            intensity: Math.min(2.4, 1.15 + dmg / 24),
            label: `HEAD! -${dmg}`,
            damage: dmg,
          });
          // Short slow-motion on big head hits
          if (dmg >= 26) {
            this.slowMoRemainingMs = 280;
          }
        }

        if (this.suddenDeath && !blockedByShield) {
          this.eliminateVehicle(other, 'Sudden Death Head Strike!');
        } else {
          this.checkIntegrityElimination(other);
        }
      }
    }
  }

  private updateHealthPickup(dtMs: number) {
    if (
      !this.pickupSpawnedThisRound &&
      !this.suddenDeath &&
      this.phaseRemainingMs <= this.roundDurationMs * 0.5
    ) {
      this.pickupSpawnedThisRound = true;
      this.pickupSeq += 1;
      this.activePickup = {
        id: `hp_${this.roundIndex}_${this.pickupSeq}`,
        x: 0,
        y: PICKUP_SPAWN_Y,
        state: 'falling',
        ttlMs: PICKUP_TTL_MS,
        maxTtlMs: PICKUP_TTL_MS,
      };
      this.emitFx({
        kind: 'pickup_spawn',
        x: 0,
        y: -110,
        color: '#10B981',
        intensity: 0.35,
        label: 'Health incoming!',
      });
    }

    const pickup = this.activePickup;
    if (!pickup) return;

    if (pickup.state === 'falling') {
      pickup.y += PICKUP_FALL_SPEED_PX_SEC * (dtMs / 1000);
      if (pickup.y >= this.pickupLandingY) {
        pickup.y = this.pickupLandingY;
        pickup.state = 'landed';
      }
    } else {
      pickup.ttlMs = Math.max(0, pickup.ttlMs - dtMs);
      if (pickup.ttlMs <= 0) {
        this.activePickup = null;
        return;
      }
      if (pickup.ttlMs <= PICKUP_FADE_MS) {
        pickup.state = 'fading';
      }
    }

    // Any rig whose body touches the pickup (in air or on ground) collects it first
    for (const v of this.vehicles.values()) {
      if (v.eliminated || !v.chassis) continue;
      const b = v.chassis.bounds;
      const insideChassis =
        pickup.x >= b.min.x - 16 &&
        pickup.x <= b.max.x + 16 &&
        pickup.y >= b.min.y - 16 &&
        pickup.y <= b.max.y + 16;
      const nearChassis =
        Math.hypot(pickup.x - v.chassis.position.x, pickup.y - v.chassis.position.y) <= 44;
      const nearRider = v.rider
        ? Math.hypot(pickup.x - v.rider.position.x, pickup.y - v.rider.position.y) <= 32
        : false;

      if (insideChassis || nearChassis || nearRider) {
        const healAmount = Math.round(v.maxRiderHp * PICKUP_HEAL_RATIO);
        const nextHp = Math.min(v.maxRiderHp, v.riderHp + healAmount);
        const gained = Math.max(0, nextHp - v.riderHp);
        v.riderHp = nextHp;

        this.emitFx({
          kind: 'heal',
          x: pickup.x,
          y: pickup.y - 12,
          color: '#22C55E',
          intensity: 0.65,
          label: gained > 0 ? `+${gained} HP` : 'MAX HP!',
          damage: gained,
        });
        this.activePickup = null;
        return;
      }
    }
  }

  private evaluateRoundOutcome() {
    const all = Array.from(this.vehicles.values());
    const alive = all.filter((v) => !v.eliminated);

    let roundDone = false;
    let winners: InternalVehicle[] = [];
    let summary = '';

    if (this.battleFormat === 'teams') {
      const aliveTeams = new Set(alive.map((v) => v.init.teamId));
      if (aliveTeams.size <= 1) {
        roundDone = true;
        const winTeam = alive[0]?.init.teamId;
        winners = winTeam ? all.filter((v) => v.init.teamId === winTeam) : [];
        summary = winTeam ? `Team ${winTeam} Wins the Clash!` : 'Double Knockout!';
      }
    } else if (alive.length <= 1) {
      roundDone = true;
      winners = alive;
      summary = alive[0]
        ? `${alive[0].init.nickname} Wins Round ${this.roundIndex}!`
        : 'Mutual Knockout!';
    }

    if (!roundDone && this.phaseRemainingMs <= 0) {
      if (this.battleFormat === 'teams') {
        const teamHp = new Map<1 | 2, number>();
        for (const v of alive) {
          teamHp.set(v.init.teamId, (teamHp.get(v.init.teamId) ?? 0) + v.riderHp);
        }
        const hp1 = teamHp.get(1) ?? 0;
        const hp2 = teamHp.get(2) ?? 0;
        if (hp1 !== hp2) {
          roundDone = true;
          const winTeam: 1 | 2 = hp1 > hp2 ? 1 : 2;
          winners = all.filter((v) => v.init.teamId === winTeam);
          summary = `Team ${winTeam} Wins on Health!`;
        } else if (!this.suddenDeath) {
          this.suddenDeath = true;
          this.phaseRemainingMs = SUDDEN_DEATH_MS;
          this.emitFx({
            kind: 'thunder',
            x: 0,
            y: 40,
            color: '#EF4444',
            intensity: 1.6,
            label: 'SUDDEN DEATH! First Head Hit Wins',
          });
        } else {
          roundDone = true;
          winners = [];
          summary = 'Sudden Death Draw!';
        }
      } else {
        const sorted = [...alive].sort((a, b) => b.riderHp - a.riderHp);
        const topHp = sorted[0]?.riderHp ?? 0;
        const tiedLeaders = sorted.filter((v) => v.riderHp === topHp);
        if (tiedLeaders.length === 1) {
          roundDone = true;
          winners = [tiedLeaders[0]];
          summary = `${tiedLeaders[0].init.nickname} Wins on Health!`;
        } else if (!this.suddenDeath) {
          this.suddenDeath = true;
          this.phaseRemainingMs = SUDDEN_DEATH_MS;
          this.emitFx({
            kind: 'thunder',
            x: 0,
            y: 40,
            color: '#EF4444',
            intensity: 1.6,
            label: 'SUDDEN DEATH! First Head Hit Wins',
          });
        } else {
          roundDone = true;
          winners = [];
          summary = 'Sudden Death Draw!';
        }
      }
    }

    if (roundDone) {
      this.setPhase('ROUND_END');
      this.phaseRemainingMs = ROUND_END_MS;
      this.roundWinnerIds = winners.map((w) => w.init.playerId);
      this.koSummary = summary;

      for (const w of winners) {
        w.roundWins += 1;
      }

      const champions = all.filter((v) => v.roundWins >= this.roundsToWin);
      if (champions.length > 0) {
        if (this.battleFormat === 'teams') {
          const champTeam = champions[0].init.teamId;
          this.matchWinnerIds = all.filter((v) => v.init.teamId === champTeam).map((v) => v.init.playerId);
        } else {
          this.matchWinnerIds = [champions[0].init.playerId];
        }
      }
    }
  }

  private emitFx(ev: Omit<VisualEffectEvent, 'id'>) {
    this.fxSeq += 1;
    this.pendingFx.push({ ...ev, id: `fx_${this.fxSeq}_${Date.now()}` });
  }

  public drainFx(): VisualEffectEvent[] {
    if (this.pendingFx.length === 0) return [];
    const copy = this.pendingFx;
    this.pendingFx = [];
    return copy;
  }

  public getSnapshot(): MatchSnapshot {
    const vehicles: VehicleSnapshot[] = Array.from(this.vehicles.values()).map((v) => {
      const cx = v.chassis?.position.x ?? 0;
      const cy = v.chassis?.position.y ?? 0;
      const rx = v.rider?.position.x ?? cx;
      const ry = v.rider?.position.y ?? cy - 36;
      const hx = v.headSensor?.position.x ?? rx;
      const hy = v.headSensor?.position.y ?? ry - 2;
      const cAngle = v.chassis?.angle ?? 0;
      const tip = this.computeLanceTip(v);
      return {
        playerId: v.init.playerId,
        nickname: v.init.nickname,
        isBot: v.init.isBot,
        teamId: v.init.teamId,
        x: Math.round(cx * 10) / 10,
        y: Math.round(cy * 10) / 10,
        angle: Math.round(cAngle * 1000) / 1000,
        vx: Math.round((v.chassis?.velocity.x ?? 0) * 100) / 100,
        vy: Math.round((v.chassis?.velocity.y ?? 0) * 100) / 100,
        riderX: Math.round(rx * 10) / 10,
        riderY: Math.round(ry * 10) / 10,
        riderAngle: Math.round((v.rider?.angle ?? 0) * 1000) / 1000,
        headHitX: Math.round(hx * 10) / 10,
        headHitY: Math.round(hy * 10) / 10,
        headRadius: HEAD_SENSOR_RADIUS,
        headFlashMs: Math.round(v.headFlashMs),
        lanceAngle: Math.round(v.lanceAngle * 1000) / 1000,
        lanceTipX: Math.round(tip.x * 10) / 10,
        lanceTipY: Math.round(tip.y * 10) / 10,
        facing: v.facing,
        riderHp: v.riderHp,
        maxRiderHp: v.maxRiderHp,
        chassisHp: v.chassisHp,
        maxChassisHp: v.maxChassisHp,
        boostEnergy: Math.round(v.boostEnergy),
        boosting: v.boosting,
        jumpCooldownMs: Math.round(v.jumpCooldownMs),
        weaponId: v.init.roomWeapon,
        weaponCooldownMs: Math.round(v.weaponCooldownMs),
        weaponMaxCooldownMs: v.weaponMaxCooldownMs,
        shieldActiveMs: Math.round(v.shieldActiveMs),
        eliminated: v.eliminated,
        eliminationReason: v.eliminationReason,
        roundWins: v.roundWins,
        cosmetics: v.init.cosmetics,
        blueprint: v.blueprint,
        connected: v.connected,
        reconnectRemainingSec: v.reconnectRemainingSec,
      };
    });

    return {
      matchId: this.matchId,
      mode: this.mode,
      battleFormat: this.battleFormat,
      arenaId: this.arena.id,
      roundIndex: this.roundIndex,
      roundsToWin: this.roundsToWin,
      phase: this.phase,
      phaseRemainingMs: Math.max(0, Math.round(this.phaseRemainingMs)),
      roundDurationMs: this.roundDurationMs,
      suddenDeath: this.suddenDeath,
      healthPickup: this.activePickup ? { ...this.activePickup } : null,
      serverTime: Date.now(),
      vehicles,
      roundWinnerIds: this.roundWinnerIds,
      matchWinnerIds: this.matchWinnerIds,
      koSummary: this.koSummary,
    };
  }
}
