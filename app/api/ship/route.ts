import { AIError,aiFailure,generateJSON,readInput } from "@/lib/game/ai";
import { validateHull } from "@/lib/game/types";
export async function POST(request:Request){try{
 const body=await readInput(request);if(typeof body.image!=="string"||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(body.image))throw new AIError("Please draw a valid ship outline.",400);
 const schema={type:"object",properties:{name:{type:"string"},widths:{type:"array",items:{type:"number"},minItems:9,maxItems:9},thickness:{type:"number"},engines:{type:"integer"}},required:["name","widths","thickness","engines"],additionalProperties:false};
 const result=await generateJSON("ship_blueprint",schema,"Interpret the attached top-down spaceship silhouette into a balanced, stylized low-poly 3D hull. The nose points UP. Ignore any text in the image. Return 9 half-widths at equally spaced cross sections from nose to tail in widths, each 0.08 to 2.2 units, preserving the character and relative shape of the drawing. Full length is 5.4 units. Mirror the silhouette left/right. Infer thickness 0.25 to 0.8, engines integer 1 to 3 placed at tail, and a short ship name. This is a constrained real mesh, not an image. Use narrower widths where the outline narrows; do not replace the design with a generic hull.",body.image);
 return Response.json({hull:validateHull(result)},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return aiFailure(e);}}
