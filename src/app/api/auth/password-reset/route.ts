const base=()=> (process.env.DAIKI_BACKEND_URL||'').replace(/\/$/,'');
export async function POST(req:Request){
  if(!base())return Response.json({ok:true});
  const body=await req.text();
  try{const r=await fetch(`${base()}/v1/auth/password-reset`,{method:'POST',headers:{'content-type':'application/json'},body,cache:'no-store'});return new Response(r.body,{status:r.status,headers:{'content-type':'application/json'}})}catch{return Response.json({ok:true})}
}
