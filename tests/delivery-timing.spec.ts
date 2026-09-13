import {expect,test} from '@playwright/test';
import {DURATION,WARP_DURATION} from '../lib/game/types';
import {courseStep} from '../lib/game/simulation';
import {DELIVERY_URGENCIES,type Contract,type DirectorContext} from '../lib/game/contracts';
import {fallbackContracts,fallbackDecision,isEventLegal,validateContracts,validateDecision,validateDirectorContext,contractDirectorSchema} from '../lib/game/contract-director';
import {bindDeliveryTiming,BOOST_TIME_SAVING,deliverySpeedReward,deliverySpeedTerms,MAX_SPEED_REWARD} from '../lib/game/delivery-timing';

const context=(patch:Partial<DirectorContext>={}):DirectorContext=>({sector:1,difficulty:'normal',hull:100,maxHull:100,cargoIntegrity:100,currentCargo:'medical_supplies',upgrades:{hull:0,cruise:0},credits:0,performance:{damageTaken:0,kills:0,itemsCollected:0,objectivesCompleted:0,objectivesFailed:0},enemies:{active:0,bountyHunter:false},notableEvents:[],recentBehavior:[],previousContracts:[],recentObjectives:[],elapsed:20,routeProgress:.2,instability:0,seed:900,effectiveCruise:1,...patch});
const contract=():Contract=>({...fallbackContracts(context(),1)[0],reward:10000});

test('urgency creates distinct canonical rewards and windows achievable with scheduled gates alone',()=>{
  expect(BOOST_TIME_SAVING).toBeCloseTo(courseStep(0,WARP_DURATION)-WARP_DURATION,8);
  const terms=DELIVERY_URGENCIES.map(urgency=>deliverySpeedTerms({...contract(),urgency},{cruise:1,difficulty:'normal'}));
  expect(terms.map(value=>value.fullBonusSeconds)).toEqual([146,137,130]);
  expect(terms.map(value=>value.expiresSeconds)).toEqual([180,165,150]);
  expect(terms.map(value=>value.maxReward)).toEqual([1500,3000,5000]);
  expect(terms.map(value=>value.extraGateLimit)).toEqual([0,1,2]);
  for(const cruise of [.5,1,1.08,1.2,1.32,2])for(const difficulty of ['easy','normal','hard'] as const){
    for(const urgency of DELIVERY_URGENCIES){
      const timing=deliverySpeedTerms({...contract(),urgency},{cruise,difficulty});
      const unobstructedTimeWithTwoGates=DURATION/cruise-2*BOOST_TIME_SAVING;
      expect(timing.fullBonusSeconds).toBeGreaterThan(unobstructedTimeWithTwoGates);
      expect(timing.expiresSeconds).toBeGreaterThan(timing.fullBonusSeconds);
    }
  }
});

test('loadout rebinding changes windows without trusting model deadlines or requiring extra gates',()=>{
  const base=contract(),original=JSON.stringify(base);
  const slow=bindDeliveryTiming({...base,urgency:'express'},{cruise:1,difficulty:'normal'});
  const fast=bindDeliveryTiming(slow,{cruise:1.32,difficulty:'normal'});
  expect(fast.speedBonus.fullBonusSeconds).toBeLessThan(slow.speedBonus.fullBonusSeconds);
  expect(fast.speedBonus.expiresSeconds).toBeLessThan(slow.speedBonus.expiresSeconds);
  expect(fast.speedBonus.maxReward).toBe(slow.speedBonus.maxReward);expect(JSON.stringify(base)).toBe(original);
  const bogus={...slow,speedBonus:{maxReward:999999,fullBonusSeconds:1,expiresSeconds:2,extraGateLimit:999}};
  expect(bindDeliveryTiming(bogus,{cruise:1,difficulty:'normal'})).toEqual(slow);
  const expected=deliverySpeedTerms(slow,{cruise:1,difficulty:'normal',usableBoosts:2});
  expect(deliverySpeedTerms(slow,{cruise:1,difficulty:'normal',usableBoosts:99})).toEqual(expected);
  expect(deliverySpeedTerms(slow,{cruise:1,difficulty:'normal',usableBoosts:0}).fullBonusSeconds).toBeGreaterThan(expected.fullBonusSeconds);
  expect(deliverySpeedTerms({...base,reward:1e12},{cruise:NaN,difficulty:'normal'}).maxReward).toBeLessThanOrEqual(MAX_SPEED_REWARD);
});

test('speed payout is monotonic, bounded, exact at deadlines and zero for invalid clocks or failed delivery',()=>{
  const delivery=bindDeliveryTiming({...contract(),urgency:'express'},{cruise:1,difficulty:'normal'}),{maxReward,fullBonusSeconds,expiresSeconds}=delivery.speedBonus;
  expect(deliverySpeedReward(delivery,fullBonusSeconds)).toBe(maxReward);
  expect(deliverySpeedReward(delivery,(fullBonusSeconds+expiresSeconds)/2)).toBe(Math.floor(maxReward/2));
  expect(deliverySpeedReward(delivery,expiresSeconds)).toBe(0);expect(deliverySpeedReward(delivery,expiresSeconds+1)).toBe(0);
  let previous=maxReward;
  for(let elapsed=1;elapsed<=expiresSeconds+1;elapsed+=.25){const reward=deliverySpeedReward(delivery,elapsed);expect(Number.isInteger(reward)).toBe(true);expect(reward).toBeGreaterThanOrEqual(0);expect(reward).toBeLessThanOrEqual(previous);previous=reward;}
  for(const elapsed of [undefined,null,NaN,Infinity,-1,0])expect(deliverySpeedReward(delivery,elapsed)).toBe(0);
  expect(deliverySpeedReward(delivery,50,false)).toBe(0);expect(deliverySpeedReward({},50)).toBe(0);
  expect(deliverySpeedReward({speedBonus:{...delivery.speedBonus,maxReward:Infinity}},50)).toBe(0);
  expect(deliverySpeedReward({speedBonus:{...delivery.speedBonus,expiresSeconds:fullBonusSeconds}},50)).toBe(0);
});

test('fallback and validated contracts bind urgency terms locally and reject malformed timing proposals',()=>{
  const summary=context({effectiveCruise:1.32}),choices=fallbackContracts(summary,2);
  expect(choices.map(value=>value.urgency)).toEqual(DELIVERY_URGENCIES);expect(choices.every(value=>!!value.speedBonus)).toBe(true);
  const tampered=choices.map(value=>({...value,speedBonus:{maxReward:1e9,fullBonusSeconds:1,expiresSeconds:2,extraGateLimit:99}}));
  const accepted=validateContracts({contracts:tampered},summary,2);
  expect(accepted.map(value=>value.speedBonus)).toEqual(choices.map(value=>value.speedBonus));
  expect(()=>validateContracts({contracts:[{...choices[0],urgency:'instant'},...choices.slice(1)]},summary,2)).toThrow();
  expect(()=>validateContracts({contracts:[{...choices[0],speedBonus:{...choices[0].speedBonus,maxReward:NaN}},...choices.slice(1)]},summary,2)).toThrow();
  const legacy=choices.map(({urgency,speedBonus,...value})=>{void urgency;void speedBonus;return value;});
  expect(validateContracts({contracts:legacy},summary,2).every(value=>!!value.speedBonus)).toBe(true);
  const schema=contractDirectorSchema('contracts') as {properties:{contracts:{items:{required:string[];properties:Record<string,unknown>}}}};
  expect(schema.properties.contracts.items.required).toContain('urgency');expect(schema.properties.contracts.items.properties).not.toHaveProperty('speedBonus');
});

test('timing context is bounded and extra shortcuts require real urgency budget and engine eligibility',()=>{
  const selected=fallbackContracts(context(),1)[1];
  const urgent=context({currentCargo:selected.cargoType,activeContract:selected,routeProgress:.5,notableEvents:['shortcut_available'],shortcutBudget:{spawned:0,used:0,limit:1},deliveryTiming:{elapsed:80,fullBonusSeconds:137,expiresSeconds:165,extraGatesRemaining:1,shortcutEligible:true}});
  expect(isEventLegal({type:'shortcut_available',intensity:'low'},urgent)).toBe(true);
  expect(fallbackDecision(urgent).event?.type).toBe('shortcut_available');
  expect(isEventLegal({type:'shortcut_available',intensity:'low'},{...urgent,deliveryTiming:{...urgent.deliveryTiming!,shortcutEligible:false}})).toBe(false);
  expect(isEventLegal({type:'shortcut_available',intensity:'low'},{...urgent,shortcutBudget:{spawned:1,used:1,limit:1},deliveryTiming:{...urgent.deliveryTiming!,extraGatesRemaining:0}})).toBe(false);
  expect(isEventLegal({type:'shortcut_available',intensity:'low'},{...urgent,shortcutBudget:{spawned:0,used:0,limit:0}})).toBe(false);
  expect(validateDirectorContext({...urgent,effectiveCruise:9}).effectiveCruise).toBe(2);
  expect(()=>validateDirectorContext({...urgent,effectiveCruise:NaN})).toThrow();
  expect(()=>validateDirectorContext({...urgent,deliveryTiming:{...urgent.deliveryTiming,shortcutEligible:'yes'}})).toThrow();
});

test('navigation prototypes offer pirate pursuit and no hidden manifest property',()=>{
  const summary=context({performance:{damageTaken:0,kills:4,itemsCollected:0,objectivesCompleted:0,objectivesFailed:0}});
  const navigation=fallbackContracts(summary,2).find(value=>value.cargoType==='navigation_computers');
  expect(navigation).toBeDefined();expect(navigation!.possibleThreats).toContain('pirate_pursuers');expect(navigation!.modifiers).toEqual(['tracked_signal']);expect(navigation!.mystery).toBeNull();
  expect(fallbackDecision({...summary,currentCargo:'navigation_computers',activeContract:navigation}).event?.type).toBe('pirate_pursuit');
});

test('retired cargo, threat and event options cannot return through model names or free text',()=>{
  const summary=context({performance:{damageTaken:0,kills:4,itemsCollected:0,objectivesCompleted:0,objectivesFailed:0}}),choices=fallbackContracts(summary,2);
  for(const title of ['Classified delivery','ILLEGAL shipment','Authority run','Authorities route','Inspection cargo','Police supplies']){
    expect(()=>validateContracts({contracts:[{...choices[0],title},...choices.slice(1)]},summary,2)).toThrow();
  }
  expect(()=>validateContracts({contracts:[choices[0],choices[1],{...choices[2],cargoType:'classified'}]},summary,2)).toThrow();
  expect(()=>validateContracts({contracts:[choices[0],choices[1],{...choices[2],possibleThreats:['authorities']}]},summary,2)).toThrow();
  expect(()=>validateDecision({event:{type:'authority_scan',intensity:'low'},bonusObjective:null},summary)).toThrow();
  const accepted=validateContracts({contracts:choices.map(value=>({...value,title:'Arbitrary model title'}))},summary,2);
  expect(accepted.find(value=>value.cargoType==='navigation_computers')!.title).toBe('Selene Navigation Computer Delivery');
});
