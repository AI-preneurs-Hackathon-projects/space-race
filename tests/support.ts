import {test} from '@playwright/test';
import {createFlight as makeFlight,disposeFlight,initializePhysics,type Flight} from '../lib/game/simulation';
import type {Hull} from '../lib/game/types';
const flights:Flight[]=[];
export function createFlight(hull:Hull){const state=makeFlight(hull);flights.push(state);return state;}
test.beforeAll(async()=>{await initializePhysics();});
test.afterEach(()=>{for(const s of flights)disposeFlight(s);flights.length=0;});
