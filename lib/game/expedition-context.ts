import type {Campaign} from './progression';
import type {Contract, DirectorContext} from './contracts';
import type {RunState} from './run-manager';
import type {Flight} from './simulation';
import {expeditionSnapshot} from './expedition-runtime';

/** A detached, bounded summary. No world, entity objects, controls or engine handles cross the API. */
export function contractContext(campaign:Campaign,run:RunState,contract:Contract|null,flight?:Flight):DirectorContext {
  return {
    sector:campaign.stage,difficulty:campaign.difficulty,hull:flight?.hull??100,maxHull:flight?.maxHull??100,
    cargoIntegrity:flight?.cargo??campaign.cargo,currentCargo:contract?.cargoType??null,
    upgrades:{hull:campaign.hullUpgrades,cruise:campaign.cruiseUpgrades},credits:run.credits,
    performance:{damageTaken:0,kills:0,itemsCollected:0,objectivesCompleted:0,objectivesFailed:0},
    enemies:{active:0,bountyHunter:false},notableEvents:[],recentBehavior:[],
    previousContracts:[...run.history.slice(-5).map(r=>r.cargoType),...(contract&&run.history.at(-1)?.contractId!==contract.id?[contract.cargoType]:[])],recentObjectives:[],
    elapsed:flight?.time??0,routeProgress:0,instability:0,seed:run.seed,
    ...(flight?expeditionSnapshot(flight):{}),
  };
}
