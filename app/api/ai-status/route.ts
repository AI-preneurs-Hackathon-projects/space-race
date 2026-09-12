import { aiConfig } from "@/lib/game/ai";
export function GET(){return Response.json({available:!!aiConfig().key},{headers:{"Cache-Control":"no-store"}});}
