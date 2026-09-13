import type {DifficultySetting} from './types';

export const CARGO_TYPES = ['medical_supplies', 'volatile_fuel', 'high_value_technology', 'classified', 'cryogenic_passengers'] as const;
export type CargoType = typeof CARGO_TYPES[number];
export const RISKS = ['low', 'medium', 'high'] as const;
export type Risk = typeof RISKS[number];
export const CARGO_MODIFIERS = ['fragile_cargo', 'unstable_fuel', 'valuable_cargo', 'restricted_cargo', 'life_support'] as const;
export type CargoModifier = typeof CARGO_MODIFIERS[number];
export const THREAT_TYPES = ['pirates', 'asteroids', 'bounty_hunters', 'authorities', 'cargo_hazards'] as const;
export type ThreatType = typeof THREAT_TYPES[number];
export const EVENT_TYPES = ['pirate_ambush', 'enemy_reinforcement', 'asteroid_wave', 'repair_opportunity', 'bounty_hunter', 'authority_scan', 'cargo_instability', 'shortcut_available'] as const;
export type EventType = typeof EVENT_TYPES[number];
/** Only primitives backed by engine counters are exposed to the director. */
export const OBJECTIVE_TYPES = ['REACH_WARP_GATE', 'MAINTAIN_CARGO_INTEGRITY', 'DESTROY_TARGET', 'SURVIVE_DURATION', 'ESCAPE_ENEMIES', 'COLLECT_ITEM', 'AVOID_DAMAGE', 'COMPLETE_WITHIN_TIME'] as const;
export type ObjectiveType = typeof OBJECTIVE_TYPES[number];
export const OBJECTIVE_TARGETS = ['gate', 'cargo', 'player', 'hostiles', 'bounty_hunter', 'shield_buoy'] as const;
export type ObjectiveTarget = typeof OBJECTIVE_TARGETS[number];

export type CargoDefinition = {
  label: string;
  description: string;
  modifiers: CargoModifier[];
  minimumIntegrity: number | null;
  damageMultiplier: number;
  hazardMultiplier: number;
  instabilityPerDamage: number;
  targetPressure: number;
  lifeSupportDrain: number;
};
export const CARGO: Record<CargoType, CargoDefinition> = {
  medical_supplies: {label:'Medical supplies', description:'Fragile medicine: deliver at 70% integrity or above. Avoid unnecessary combat.', modifiers:['fragile_cargo'], minimumIntegrity:70, damageMultiplier:1.35, hazardMultiplier:1, instabilityPerDamage:0, targetPressure:1, lifeSupportDrain:0},
  volatile_fuel: {label:'Volatile fuel', description:'Hits build instability. High instability triggers dangerous surges; clean flying cools the cargo.', modifiers:['unstable_fuel'], minimumIntegrity:null, damageMultiplier:1, hazardMultiplier:1, instabilityPerDamage:1.5, targetPressure:1, lifeSupportDrain:0},
  high_value_technology: {label:'High-value technology', description:'Valuable prototypes attract aggressive pirates and bounty hunters.', modifiers:['valuable_cargo'], minimumIntegrity:null, damageMultiplier:1, hazardMultiplier:1, instabilityPerDamage:0, targetPressure:1.4, lifeSupportDrain:0},
  classified: {label:'Classified cargo', description:'Restricted cargo attracts authority patrols. Evading a patrol preserves the shipment.', modifiers:['restricted_cargo'], minimumIntegrity:null, damageMultiplier:1, hazardMultiplier:1, instabilityPerDamage:0, targetPressure:1.15, lifeSupportDrain:0},
  cryogenic_passengers: {label:'Cryogenic passengers', description:'Cargo integrity powers life support. Hazards cause extra damage; deliver at 50% integrity or above.', modifiers:['life_support'], minimumIntegrity:50, damageMultiplier:1.15, hazardMultiplier:1.4, instabilityPerDamage:0, targetPressure:1, lifeSupportDrain:.025},
};

export type Contract = {
  id: string;
  title: string;
  description: string;
  cargoType: CargoType;
  destination: string;
  sector: number;
  reward: number;
  risk: Risk;
  minimumCargoIntegrity: number | null;
  modifiers: CargoModifier[];
  possibleThreats: ThreatType[];
  possibleObjectives: ObjectiveType[];
  mystery: string | null;
};
export type EventProposal = {type: EventType; intensity: Risk};
/** Durations count forward from local activation. Success is evaluated only by engine code. */
export type ObjectiveCondition = {type: ObjectiveType; target: ObjectiveTarget; successCondition: number; duration: number | null};
export type BonusObjective = {id: string; conditions: ObjectiveCondition[]; reward: number; uiText: string};
export type DirectorDecision = {event: EventProposal | null; bonusObjective: BonusObjective | null};
export type DirectorContext = {
  sector: number;
  difficulty: DifficultySetting;
  activeContract?: Pick<Contract, 'risk' | 'possibleThreats' | 'possibleObjectives' | 'minimumCargoIntegrity'>;
  availableTargets?: {shieldBuoys: number};
  hull: number;
  maxHull: number;
  cargoIntegrity: number;
  currentCargo: CargoType | null;
  upgrades: {hull: number; cruise: number};
  credits: number;
  performance: {damageTaken: number; kills: number; itemsCollected: number; objectivesCompleted: number; objectivesFailed: number};
  enemies: {active: number; bountyHunter: boolean};
  notableEvents: EventType[];
  recentBehavior: string[];
  previousContracts: CargoType[];
  recentObjectives: ObjectiveType[];
  elapsed: number;
  routeProgress: number;
  instability: number;
  seed: number;
};
