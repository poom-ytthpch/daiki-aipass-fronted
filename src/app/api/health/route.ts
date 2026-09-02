export async function GET(){return Response.json({service:'daiki-ai-passport-frontend',status:'ok',gateway:process.env.LITELLM_BASE_URL??'not-configured'})}
