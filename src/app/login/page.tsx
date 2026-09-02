export const dynamic='force-dynamic';

type LoginProps={searchParams:Promise<{error?:string}>};

export default async function Login({searchParams}:LoginProps){
  const {error}=await searchParams;
  const googleEnabled=Boolean(process.env.GOOGLE_CLIENT_ID);
  return <main className="loginPage">
    <section className="loginCard authCard">
      <div className="authBrand">
        <div className="logo large">D</div>
        <div><div className="h1">Daiki AI Passport</div><p className="muted">Sign in or create an account to continue.</p></div>
      </div>
      {error==='google_not_configured'&&<div className="authNotice">Google OAuth is not configured for this environment yet.</div>}
      <div className="authActions">
        <a href="/api/auth/login" className="btn primary loginBtn">Sign in with email</a>
        <a href="/api/auth/register" className="btn loginBtn">Create account</a>
      </div>
      <div className="authDivider"><span>or</span></div>
      {googleEnabled
        ? <a href="/api/auth/login?provider=google" className="btn oauthBtn"><span className="googleMark">G</span>Continue with Google</a>
        : <button type="button" className="btn oauthBtn" disabled title="Google OAuth requires a configured Google OAuth client and public callback domain"><span className="googleMark">G</span>Continue with Google <span className="oauthState">Not configured</span></button>}
      <p className="authHint">New accounts start with restricted Chat access until an administrator approves the account.</p>
      <div className="loginMeta"><span>Keycloak OIDC</span><span>Pending access policy</span><span>Private gateway</span></div>
    </section>
  </main>;
}
