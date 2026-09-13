import {expect,test} from '@playwright/test';
import {beginAttempt,finishAttempt,leaveFlight,newCampaign} from '../lib/game/progression';

test('a surviving expedition can return to the hangar and resume with zero cargo without resetting upgrades',()=>{
 const started=beginAttempt({...newCampaign(47),stage:3,hullUpgrades:2,cruiseUpgrades:1},undefined,true)!;
 const parked=leaveFlight(started.campaign,{hull:42,cargo:0},true);
 expect(parked).toMatchObject({status:'ready',stage:3,hull:42,cargo:0,hullUpgrades:2,cruiseUpgrades:1});
 const resumed=beginAttempt(parked,undefined,true)!;
 expect(resumed.campaign).toMatchObject({status:'flying',stage:3,hull:42,cargo:0,hullUpgrades:2,cruiseUpgrades:1});
 const arrived=finishAttempt(resumed.campaign,resumed.campaign.attempt,'delivered',{hull:130,maxHull:130,arrivalHull:42,cargo:0},true);
 expect(arrived.status).toBe('cleared');
});

test('relief repairs survive hangar and gate accounting even after a partially damaged sector resumes',()=>{
 const first=beginAttempt(newCampaign(91),undefined,true)!;
 const parked=leaveFlight(first.campaign,{hull:50,cargo:20.5},true);
 const resumed=beginAttempt(parked,undefined,true)!;
 expect(leaveFlight(resumed.campaign,{hull:68,cargo:28.5},true).cargo).toBe(28.5);
 const arrived=finishAttempt(resumed.campaign,resumed.campaign.attempt,'delivered',{hull:100,maxHull:100,arrivalHull:68,cargo:28.5},true);
 expect(arrived).toMatchObject({status:'cleared',cargo:28.5,arrival:{cargo:28.5,hull:68}});
});
