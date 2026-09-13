import {expect,test} from '@playwright/test';
import {fallbackContracts} from '../lib/game/contract-director';
import {contractContext} from '../lib/game/expedition-context';
import {bindDeliveryTiming} from '../lib/game/delivery-timing';
import {newCampaign} from '../lib/game/progression';
import {finishRun,newRun,resolveDelivery} from '../lib/game/run-manager';

const contract=()=>bindDeliveryTiming({...fallbackContracts(contractContext(newCampaign(39),newRun(39),null),1)[0],urgency:'express'},{cruise:1,difficulty:'normal'});
const metrics={cargoIntegrity:90,damageTaken:10,bonusReward:400,objectivesCompleted:['Hold cargo steady']};

test('otherwise identical successful deliveries earn monotonically less speed pay while preserving base and objective pay',()=>{
 const manifest=contract(),terms=manifest.speedBonus!;
 const times=[terms.fullBonusSeconds-1,terms.fullBonusSeconds+(terms.expiresSeconds-terms.fullBonusSeconds)/4,(terms.fullBonusSeconds+terms.expiresSeconds)/2,terms.expiresSeconds+10];
 const settled=times.map(elapsed=>resolveDelivery(newRun(39),manifest,{...metrics,elapsed}));
 expect(settled[0].result.speedReward).toBe(terms.maxReward);
 expect(settled[2].result.speedReward).toBe(Math.floor(terms.maxReward/2));
 expect(settled[3].result.speedReward).toBe(0);
 for(let i=1;i<settled.length;i++)expect(settled[i-1].result.totalReward).toBeGreaterThan(settled[i].result.totalReward);
 for(const {run,result} of settled){
  expect(result).toMatchObject({success:true,baseReward:manifest.reward,bonusReward:400});
  expect(result.totalReward).toBe(manifest.reward+400+result.speedReward);
  expect(run).toMatchObject({status:'active',deliveriesCompleted:1,sectorsCompleted:1,totalReward:result.totalReward,credits:result.totalReward});
 }
});

test('expired timing terms never fail an otherwise valid cargo delivery; cargo failure does forfeit speed pay',()=>{
 const manifest=contract();
 const late=resolveDelivery(newRun(39),manifest,{...metrics,elapsed:manifest.speedBonus!.expiresSeconds+500});
 expect(late.result).toMatchObject({success:true,baseReward:manifest.reward,speedReward:0,bonusReward:400});
 const failed=resolveDelivery(newRun(39),manifest,{...metrics,cargoIntegrity:manifest.minimumCargoIntegrity!-.1,elapsed:15});
 expect(failed.result).toMatchObject({success:false,baseReward:0,speedReward:0,bonusReward:400,totalReward:400});
 expect(failed.run.status).toBe('active');
});

test('missing or corrupt clocks cannot grant a speed reward, and settlement cannot pay twice or pay after death',()=>{
 const manifest=contract();
 for(const elapsed of [undefined,NaN,Infinity,-1]){
  expect(resolveDelivery(newRun(39),manifest,{...metrics,elapsed}).result.speedReward).toBe(0);
 }
 const first=resolveDelivery(newRun(39),manifest,{...metrics,elapsed:100});
 const duplicate=resolveDelivery(first.run,manifest,{...metrics,elapsed:1});
 expect(duplicate.run).toBe(first.run);expect(duplicate.result).toBe(first.result);
 const over=resolveDelivery(finishRun(newRun(39)),manifest,{...metrics,elapsed:100});
 expect(over.result).toMatchObject({baseReward:0,speedReward:0,bonusReward:0,totalReward:0});
});
