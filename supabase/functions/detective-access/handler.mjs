// Server only. Supabase injects credentials; no privileged keys reach browsers.
export function createHandler({createClient, env, crypto=globalThis.crypto, logger=console}) {
  const ROOT='12b1d5ba-432f-47b5-857d-793347769c16';
  const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, x-client-info, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
  const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
  return async request=>{
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(request.method!=='POST')return reply({error:'Method not allowed'},405);
    let orphan=null,admin;
    try {
      const text=await request.text();
      if(new TextEncoder().encode(text).length>4096)return reply({error:'请求过大'},413);
      let body;try{body=JSON.parse(text)}catch{return reply({error:'请求格式不正确'},400)}
      if(!body||Array.isArray(body)||typeof body!=='object')return reply({error:'请求格式不正确'},400);
      const {action,slug,password}=body;
      if(!['create','list','reset','unlock'].includes(action))return reply({error:'操作不支持'},400);
      if(action!=='list'&&(typeof slug!=='string'||!/^[a-z0-9][a-z0-9_-]{2,63}$/.test(slug)||['main','root'].includes(slug)))return reply({error:'子链接编号不正确'},400);
      const url=env.get('SUPABASE_URL'),key=env.get('SUPABASE_ANON_KEY'),service=env.get('SUPABASE_SERVICE_ROLE_KEY');
      if(!url||!key||!service)throw Error('Backend configuration missing');
      admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
      if(action==='unlock') {
        if(typeof password!=='string'||!password||password.length>128)return reply({error:'链接或密码不正确'},401);
        const {data:editor,error:lookup}=await admin.from('detective_v13_editors').select('login_email').eq('slug',slug).maybeSingle();
        if(lookup)throw lookup;
        if(!editor||typeof editor.login_email!=='string')return reply({error:'链接或密码不正确'},401);
        const {data:allowed,error:limit}=await admin.rpc('detective_v13_take_login_attempt',{p_slug:slug});
        if(limit)throw limit;
        if(!allowed)return reply({error:'尝试次数过多，请在 15 分钟后重试'},429);
        const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
        const {data,error}=await client.auth.signInWithPassword({email:editor.login_email,password});
        if(error||!data.session)return reply({error:'链接或密码不正确'},401);
        return reply({session:{access_token:data.session.access_token,refresh_token:data.session.refresh_token}});
      }
      const token=request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
      if(!token)return reply({error:'请先在主链接登录管理员账号'},401);
      const {data:{user},error:auth}=await admin.auth.getUser(token);
      if(auth||!user)return reply({error:'登录已失效，请重新登录'},401);
      if(user.id!==ROOT)return reply({error:'只有主链接管理员可以分发或重置子链接'},403);
      if(action==='list') {
        const {data,error}=await admin.from('detective_v13_editors').select('slug,created_at').order('created_at',{ascending:false});
        if(error)throw error;
        return reply({profiles:data||[]});
      }
      if(typeof password!=='string'||password.length<12||password.length>64||new TextEncoder().encode(password).length>72)return reply({error:'密码须为 12–64 个字符，UTF-8 长度不超过 72 字节'},400);
      const {data:existing,error:lookup}=await admin.from('detective_v13_editors').select('user_id').eq('slug',slug).maybeSingle();
      if(lookup)throw lookup;
      const previousUser=existing&&typeof existing.user_id==='string'?existing.user_id:null;
      if(action==='create'&&existing)return reply({error:'编号已经使用，请使用其他编号'},409);
      if(action==='reset'&&!previousUser)return reply({error:'子链接不存在'},404);
      const email='detective-'+crypto.randomUUID()+'@profiles.invalid';
      const {data:created,error:creation}=await admin.auth.admin.createUser({email,password,email_confirm:true});
      if(creation||!created.user)throw creation||Error('Auth creation failed');
      orphan=created.user.id;
      const args=action==='create'?{p_slug:slug,p_user_id:orphan,p_email:email}
        :{p_slug:slug,p_expected_user:previousUser,p_new_user:orphan,p_email:email};
      const {error:save}=await admin.rpc(action==='create'?'detective_v13_create_editor':'detective_v13_replace_editor',args);
      if(save)throw save;
      orphan=null;
      if(action==='reset'&&previousUser) {
        // Rotate owner_id first: old access tokens lose DB/Storage writes now.
        // Keep the identity because Supabase Storage may still reference it.
        const {error:ban}=await admin.auth.admin.updateUserById(previousUser,{ban_duration:'876000h'}).catch(()=>({error:true}));
        if(ban)logger.warn('Old identity ban failed; RLS ownership already rotated');
      }
      return reply({slug});
    } catch(error) {
      if(orphan&&admin)try{await admin.auth.admin.deleteUser(orphan)}catch{logger.warn('Unlinked identity cleanup failed')}
      const code=error&&typeof error==='object'&&'code' in error?String(error.code):'BackendError';
      logger.error('detective-access failed',code);
      return reply({error:'操作未完成，请确认子链接 SQL 与 detective-access 函数已安装，再重试；详情请查看函数日志。'},500);
    }
  };
}
