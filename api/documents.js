const {sb,authUser}=require('./_supabase');
const SUPABASE_URL=process.env.SUPABASE_URL;
const SECRET=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET='seafarer-documents';
const ALLOWED={resume:['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'],coc:['application/pdf','image/jpeg','image/png'],stcw:['application/pdf','image/jpeg','image/png'],medical:['application/pdf','image/jpeg','image/png'],passport_cdc:['application/pdf','image/jpeg','image/png'],other:['application/pdf','image/jpeg','image/png']};
const MAX={resume:5*1024*1024,coc:10*1024*1024,stcw:10*1024*1024,medical:10*1024*1024,passport_cdc:10*1024*1024,other:10*1024*1024};
async function profileFor(token){const user=await authUser(token),id=encodeURIComponent(user.id);const p=(await sb(`/rest/v1/profiles?id=eq.${id}&select=id,role,is_active`))?.[0];if(!p||p.role!=='seafarer'||!p.is_active)throw Error('Seafarer access required');return user;}
async function isPro(id){const rows=await sb(`/rest/v1/subscriptions?user_id=eq.${encodeURIComponent(id)}&plan=eq.seafarer_pro&status=eq.active&select=id&limit=1`);return !!rows?.length;}
function safeName(n){return String(n||'file').replace(/[^a-zA-Z0-9._-]/g,'_').slice(-120)}
module.exports=async function(req,res){try{
 const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();if(!token)throw Error('Unauthorized');const user=await profileFor(token);const id=user.id;
 if(req.method==='GET'){
  const download=String(req.query?.download||'');
  if(download){const row=(await sb(`/rest/v1/seafarer_documents?id=eq.${encodeURIComponent(download)}&user_id=eq.${encodeURIComponent(id)}&select=id,storage_path,file_name,mime_type`))?.[0];if(!row) return res.status(404).json({error:'Document not found'});const sign=await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${row.storage_path}`,{method:'POST',headers:{Authorization:`Bearer ${SECRET}`,apikey:SECRET,'Content-Type':'application/json'},body:JSON.stringify({expiresIn:3600})});const sd=await sign.json().catch(()=>({}));if(!sign.ok)throw Error(sd.message||'Unable to create secure download');return res.json({url:`${SUPABASE_URL}/storage/v1${sd.signedURL||sd.signedUrl}`});}
  const rows=await sb(`/rest/v1/seafarer_documents?user_id=eq.${encodeURIComponent(id)}&select=id,kind,file_name,mime_type,size_bytes,created_at&order=created_at.desc`);return res.json({documents:rows||[]});
 }
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 const b=req.body||{},kind=String(b.kind||'').toLowerCase();if(!ALLOWED[kind])return res.status(400).json({error:'Invalid document type'});if(kind!=='resume'&&!await isPro(id))return res.status(403).json({error:'Certificates and documents are available only on Seafarer Pro.'});
 const mime=String(b.mimeType||'').toLowerCase(),name=safeName(b.fileName);if(!ALLOWED[kind].includes(mime))return res.status(400).json({error:'Unsupported file type. Use PDF, JPG or PNG as applicable.'});
 const raw=String(b.data||'').replace(/^data:[^;]+;base64,/,'');const buf=Buffer.from(raw,'base64');if(!buf.length)throw Error('File is empty');if(buf.length>MAX[kind])throw Error(`File is too large. Maximum size is ${MAX[kind]/1024/1024} MB.`);
 const path=`${id}/${kind}/${Date.now()}-${name}`;const up=await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`,{method:'POST',headers:{Authorization:`Bearer ${SECRET}`,apikey:SECRET,'Content-Type':mime,'x-upsert':'false'},body:buf});const ud=await up.json().catch(()=>({}));if(!up.ok)throw Error(ud.message||ud.error||'Storage upload failed. Run sql/002_documents.sql first if the document vault is not enabled.');
 const row=(await sb('/rest/v1/seafarer_documents',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({user_id:id,kind,file_name:name,mime_type:mime,size_bytes:buf.length,storage_path:path})}))?.[0];
 if(kind==='resume')await sb(`/rest/v1/seafarer_profiles?user_id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({resume_url:path,updated_at:new Date().toISOString()})});
 return res.status(201).json({message:kind==='resume'?'Resume uploaded successfully.':'Document uploaded successfully.',document:row});
 }catch(e){console.error(e);return res.status(400).json({error:e.message||'Document operation failed'});}};
