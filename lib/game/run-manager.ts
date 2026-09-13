import type {CargoType, Contract} from './contracts';

export type DeliveryMetrics = {
  cargoIntegrity: number;
  damageTaken: number;
  bonusReward: number;
  objectivesCompleted: string[];
  objectivesFailed?: string[];
  elapsed?: number;
};
export type DeliveryResult = {
  contractId: string;
  sector: number;
  cargoType: CargoType;
  title: string;
  success: boolean;
  cargoIntegrity: number;
  minimumCargoIntegrity: number | null;
  baseReward: number;
  bonusReward: number;
  totalReward: number;
  damageTaken: number;
  objectivesCompleted: string[];
  objectivesFailed: string[];
};
export type RunState = {
  seed: number;
  sectorsCompleted: number;
  deliveriesCompleted: number;
  deliveriesAttempted: number;
  totalReward: number;
  credits: number;
  bestSector: number;
  score: number;
  status: 'active' | 'over';
  resolvedContractIds: string[];
  history: DeliveryResult[];
};
const bounded = (value:number,min:number,max:number) => Number.isFinite(value) ? Math.max(min,Math.min(max,value)) : min;
export function newRun(seed=Date.now()):RunState {
  return {seed:seed>>>0,sectorsCompleted:0,deliveriesCompleted:0,deliveriesAttempted:0,totalReward:0,credits:0,bestSector:1,score:0,status:'active',resolvedContractIds:[],history:[]};
}
/** Resolves local engine metrics once per accepted contract, never an AI verdict. */
export function resolveDelivery(run:RunState,contract:Contract,metrics:DeliveryMetrics):{run:RunState;result:DeliveryResult} {
  const previous=run.history.find(result=>result.contractId===contract.id);
  if(previous)return {run,result:previous};
  const cargoIntegrity=bounded(metrics.cargoIntegrity,0,100);
  const success=cargoIntegrity>0 && cargoIntegrity>=(contract.minimumCargoIntegrity??0);
  const baseReward=success?Math.round(bounded(contract.reward,0,1000000)):0;
  const bonusReward=Math.round(bounded(metrics.bonusReward,0,1000000));
  const result:DeliveryResult={contractId:contract.id,sector:contract.sector,cargoType:contract.cargoType,title:contract.title,success,cargoIntegrity,minimumCargoIntegrity:contract.minimumCargoIntegrity,baseReward,bonusReward,totalReward:baseReward+bonusReward,damageTaken:bounded(metrics.damageTaken,0,1000000),objectivesCompleted:metrics.objectivesCompleted.slice(0,30),objectivesFailed:(metrics.objectivesFailed??[]).slice(0,30)};
  if(run.status!=='active')return {run,result:{...result,baseReward:0,bonusReward:0,totalReward:0}};
  return {result,run:{...run,sectorsCompleted:run.sectorsCompleted+1,deliveriesCompleted:run.deliveriesCompleted+(success?1:0),deliveriesAttempted:run.deliveriesAttempted+1,totalReward:run.totalReward+result.totalReward,credits:run.credits+result.totalReward,bestSector:Math.max(run.bestSector,contract.sector),score:run.score+result.totalReward+1000+(success?Math.round(cargoIntegrity*10):0),resolvedContractIds:[...run.resolvedContractIds,contract.id],history:[...run.history,result]}};
}
export function finishRun(run:RunState):RunState {
  return run.status==='over'?run:{...run,status:'over',deliveriesAttempted:run.deliveriesAttempted+1,bestSector:Math.max(run.bestSector,run.sectorsCompleted+1)};
}
export function cargoSuccessRate(run:RunState):number {
  return run.deliveriesAttempted?Math.round(run.deliveriesCompleted/run.deliveriesAttempted*100):0;
}
