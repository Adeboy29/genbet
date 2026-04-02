import { useState, useEffect, useCallback } from "react";

// ── CONFIG ────────────────────────────────────────────────────────────────────
const CONTRACT_ADDRESS = "0x185626CBfB63234d0B4BC9f1924E9859D40CDe93"; // ← replace with your FULL address
const RPC_URL = "https://studio.genlayer.com/api";

// ── Helpers ───────────────────────────────────────────────────────────────────
const toGEN   = (wei) => wei ? (Number(BigInt(String(wei))) / 1e18).toFixed(2) : "0.00";
const pct     = (a,b) => { const t=Number(a||0)+Number(b||0); return t===0?50:Math.round(Number(a||0)/t*100); };
const short   = (a)   => a ? `${a.slice(0,6)}...${a.slice(-4)}` : "";
const catIcon = (c)   => ({crypto:"₿",sports:"⚽",world:"🌍"})[c]||"📊";
const catClr  = (c)   => ({crypto:"#f59e0b",sports:"#10b981",world:"#3b82f6"})[c]||"#a855f7";

// ── GenLayer RPC ──────────────────────────────────────────────────────────────
const glRpc = async (method, params=[]) => {
  const res  = await fetch(RPC_URL, {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ jsonrpc:"2.0", id:Date.now(), method, params }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
};

const readContract = async () => {
  const result = await glRpc("gen_call", [{
    to: CONTRACT_ADDRESS,
    data: { method:"get_state", args:[] },
  }, "latest"]);
  return JSON.parse(result);
};

// gasless — uses GenLayer's own RPC, no ETH gas needed
const sendTx = async (from, method, valueGEN=0) => {
  const hash = await glRpc("gen_sendTransaction", [{
    from,
    to:    CONTRACT_ADDRESS,
    value: String(Math.floor(valueGEN * 1e18)),
    data:  { method, args:[] },
  }]);
  return hash;
};

// poll for finalization
const waitFinalized = async (hash, onStatus) => {
  for (let i=0; i<40; i++) {
    await new Promise(r=>setTimeout(r,3000));
    try {
      const receipt = await glRpc("gen_getTransactionReceipt", [hash]);
      if (onStatus) onStatus(receipt?.status||"PENDING");
      if (receipt?.status==="FINALIZED") return receipt;
      if (receipt?.status==="CANCELED")  throw new Error("Transaction was cancelled");
    } catch(e) { if (e.message?.includes("cancelled")) throw e; }
  }
  throw new Error("Transaction timed out");
};

// ── Static particles ──────────────────────────────────────────────────────────
const DOTS = [...Array(22)].map((_,i)=>({
  w:1+Math.random()*3, l:Math.random()*100, t:Math.random()*100,
  o:0.08+Math.random()*0.2, d:7+Math.random()*8, dl:Math.random()*7,
  c:["#a855f7","#7c3aed","#c084fc","#6d28d9"][i%4],
}));

function Particles() {
  return (
    <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,overflow:"hidden"}}>
      {DOTS.map((d,i)=>(
        <div key={i} style={{position:"absolute",borderRadius:"50%",
          width:d.w,height:d.w,background:d.c,
          left:`${d.l}%`,top:`${d.t}%`,opacity:d.o,
          animation:`float ${d.d}s ease-in-out ${d.dl}s infinite`}}/>
      ))}
    </div>
  );
}

// ── Wallet modal ──────────────────────────────────────────────────────────────
function WalletModal({ onConnect, onClose }) {
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState("");

  const connect = async () => {
    setBusy(true); setError("");
    try {
      if (!window.ethereum) throw new Error("MetaMask not found.\nInstall it from metamask.io then refresh.");
      const accounts = await window.ethereum.request({ method:"eth_requestAccounts" });
      if (!accounts.length) throw new Error("No accounts found in MetaMask");
      onConnect(accounts[0]);
    } catch(e) { setError(e.message||"Connection failed"); }
    setBusy(false);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",backdropFilter:"blur(8px)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"linear-gradient(160deg,#0c0c1e,#130f2e)",border:"1px solid rgba(139,92,246,0.25)",borderRadius:24,padding:32,width:"100%",maxWidth:380,boxShadow:"0 0 80px rgba(124,58,237,0.2)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:28}}>
          <div>
            <div style={{fontWeight:900,fontSize:18}}>Connect Wallet</div>
            <div style={{fontSize:12,color:"rgba(237,232,255,0.35)",marginTop:2}}>Sign in to place bets &amp; resolve</div>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.06)",border:"none",borderRadius:8,width:32,height:32,color:"rgba(237,232,255,0.5)",cursor:"pointer",fontSize:16}}>✕</button>
        </div>

        <button onClick={connect} disabled={busy} style={{width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(139,92,246,0.2)",borderRadius:16,padding:"18px 20px",display:"flex",alignItems:"center",gap:14,cursor:"pointer",transition:"all 0.2s",opacity:busy?0.6:1}}
          onMouseEnter={e=>e.currentTarget.style.background="rgba(139,92,246,0.1)"}
          onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.04)"}>
          <div style={{width:44,height:44,borderRadius:12,background:"linear-gradient(135deg,#f97316,#fb923c)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>🦊</div>
          <div style={{textAlign:"left",flex:1}}>
            <div style={{fontWeight:700,fontSize:15,color:"#ede8ff"}}>MetaMask</div>
            <div style={{fontSize:12,color:"rgba(237,232,255,0.4)",marginTop:2}}>Connect using browser extension</div>
          </div>
          {busy && <div className="sp"/>}
        </button>

        <div style={{marginTop:12,background:"rgba(139,92,246,0.08)",border:"1px solid rgba(139,92,246,0.15)",borderRadius:12,padding:"12px 14px"}}>
          <div style={{fontSize:12,color:"#a78bfa",fontWeight:700,marginBottom:4}}>💡 No gas needed</div>
          <div style={{fontSize:12,color:"rgba(237,232,255,0.4)",lineHeight:1.6}}>GenLayer Studio is gasless. MetaMask is only used to identify your wallet address — no ETH required.</div>
        </div>

        {error && (
          <div style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:12,padding:"12px 16px",marginTop:12}}>
            <div style={{fontSize:13,color:"#fca5a5",whiteSpace:"pre-line"}}>{error}</div>
          </div>
        )}

        <div style={{marginTop:16,fontSize:11,color:"rgba(237,232,255,0.18)",textAlign:"center",lineHeight:1.7}}>
          Your wallet is used for identification only.<br/>Transactions are signed by GenLayer Studio.
        </div>
      </div>
    </div>
  );
}

// ── TX status bar ─────────────────────────────────────────────────────────────
function TxBar({ hash, status, onClose }) {
  if (!hash) return null;
  const done   = status==="FINALIZED";
  const failed = status==="CANCELED";
  const color  = done?"#34d399":failed?"#f87171":"#c084fc";
  const border = done?"rgba(16,185,129,0.4)":failed?"rgba(239,68,68,0.4)":"rgba(139,92,246,0.3)";
  return (
    <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",zIndex:200,
      background:"linear-gradient(135deg,#0c0c1e,#130f2e)",border:`1px solid ${border}`,
      borderRadius:16,padding:"14px 20px",minWidth:300,maxWidth:"calc(100vw - 32px)",
      boxShadow:`0 8px 32px ${done?"rgba(16,185,129,0.15)":failed?"rgba(239,68,68,0.15)":"rgba(124,58,237,0.2)"}`,
      display:"flex",alignItems:"center",gap:12,animation:"slideU 0.3s ease"}}>
      {done?"✅":failed?"❌":<div className="sp" style={{flexShrink:0}}/>}
      <div style={{flex:1}}>
        <div style={{fontSize:13,fontWeight:700,color}}>{done?"Transaction Finalized!":failed?"Transaction Failed":status||"Processing..."}</div>
        <div className="mono" style={{fontSize:10,color:"rgba(237,232,255,0.3)",marginTop:2}}>{short(hash)}</div>
      </div>
      {(done||failed) && <button onClick={onClose} style={{background:"none",border:"none",color:"rgba(237,232,255,0.3)",cursor:"pointer",fontSize:14,flexShrink:0}}>✕</button>}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [account,    setAccount]    = useState(null);
  const [showWallet, setShowWallet] = useState(false);
  const [market,     setMarket]     = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [betAmt,     setBetAmt]     = useState("100");
  const [busy,       setBusy]       = useState("");
  const [toast,      setToast]      = useState(null);
  const [tab,        setTab]        = useState("bet");
  const [txHash,     setTxHash]     = useState(null);
  const [txStatus,   setTxStatus]   = useState("");

  const show = (msg, type="success") => {
    setToast({msg,type});
    setTimeout(()=>setToast(null),4000);
  };

  const load = useCallback(async () => {
    try { setMarket(await readContract()); }
    catch {
      setMarket({
        question:"Will BTC reach 100000 USD before July 2026?",
        category:"crypto", resolved:false, outcome:false,
        total_yes:"100000000000000000000", total_no:"50000000000000000000",
        yes_odds:"175", no_odds:"120",
      });
    }
    setLoading(false);
  },[]);

  useEffect(()=>{ load(); },[load]);

  useEffect(()=>{
    if (!window.ethereum) return;
    const h = (accs) => {
      if (!accs.length) { setAccount(null); show("Wallet disconnected"); }
      else setAccount(accs[0]);
    };
    window.ethereum.on("accountsChanged", h);
    return ()=>window.ethereum.removeListener("accountsChanged", h);
  },[]);

  const handleConnect = (addr) => {
    setAccount(addr);
    setShowWallet(false);
    show(`Connected: ${short(addr)}`);
  };

  const disconnect = () => { setAccount(null); show("Wallet disconnected"); };

  // send gasless tx via GenLayer RPC
  const handleTx = async (method, valueGEN=0) => {
    if (!account) { setShowWallet(true); return; }
    const hash = await sendTx(account, method, valueGEN);
    setTxHash(hash);
    setTxStatus("PENDING");
    await waitFinalized(hash, setTxStatus);
    setTxStatus("FINALIZED");
    await load();
  };

  const bet = async (side) => {
    if (!betAmt||Number(betAmt)<=0) return show("Enter a valid amount","error");
    if (!account) { setShowWallet(true); return; }
    setBusy(side);
    try {
      await handleTx(side==="yes"?"bet_yes":"bet_no", Number(betAmt));
      show(`${side==="yes"?"✅ YES":"❌ NO"} bet of ${betAmt} GEN placed!`);
    } catch(e) {
      show(e.message||"Bet failed","error");
      setTxStatus("CANCELED");
    }
    setBusy("");
  };

  const resolve = async () => {
    if (!account) { setShowWallet(true); return; }
    setBusy("resolve");
    try {
      await handleTx("resolve", 0);
      show("Market resolved by AI consensus! 🎉");
    } catch(e) {
      show(e.message||"Resolution failed","error");
      setTxStatus("CANCELED");
    }
    setBusy("");
  };

  const yesPct    = market ? pct(market.total_yes,market.total_no) : 50;
  const noPct     = 100-yesPct;
  const totalPool = market ? (Number(toGEN(market.total_yes))+Number(toGEN(market.total_no))).toFixed(2) : "0";
  const yesWin    = market&&betAmt ? (Number(betAmt)*Number(market.yes_odds)/100).toFixed(2) : "0";
  const noWin     = market&&betAmt ? (Number(betAmt)*Number(market.no_odds)/100).toFixed(2)  : "0";

  return (<>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');
      *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
      body{background:#06060f;color:#ede8ff;font-family:'Outfit',sans-serif;min-height:100vh;}
      @keyframes float {0%,100%{transform:translateY(0);}50%{transform:translateY(-18px);}}
      @keyframes pulse {0%,100%{opacity:1;}50%{opacity:0.4;}}
      @keyframes slideD{from{transform:translateY(-14px);opacity:0;}to{transform:translateY(0);opacity:1;}}
      @keyframes slideU{from{transform:translate(-50%,20px);opacity:0;}to{transform:translate(-50%,0);opacity:1;}}
      @keyframes spin  {to{transform:rotate(360deg);}}
      @keyframes glow  {0%,100%{box-shadow:0 0 20px rgba(124,58,237,0.3);}50%{box-shadow:0 0 44px rgba(124,58,237,0.6);}}
      @keyframes barIn {from{width:0;}}
      .card{background:linear-gradient(160deg,#0c0c1e,#0f0b24);border:1px solid rgba(139,92,246,0.12);border-radius:24px;box-shadow:0 0 60px rgba(109,40,217,0.06),inset 0 1px 0 rgba(255,255,255,0.04);}
      .btn{border:none;border-radius:14px;cursor:pointer;font-family:'Outfit',sans-serif;font-weight:700;font-size:15px;padding:14px 24px;transition:all 0.18s;}
      .btn:disabled{opacity:0.4;cursor:not-allowed;}
      .btn:not(:disabled):hover{transform:translateY(-2px);}
      .btn:not(:disabled):active{transform:translateY(1px);}
      .btn-yes{background:linear-gradient(135deg,#047857,#059669);color:#fff;box-shadow:0 4px 20px rgba(5,150,105,0.2);}
      .btn-yes:not(:disabled):hover{box-shadow:0 8px 28px rgba(5,150,105,0.35);}
      .btn-no{background:linear-gradient(135deg,#b91c1c,#dc2626);color:#fff;box-shadow:0 4px 20px rgba(220,38,38,0.2);}
      .btn-no:not(:disabled):hover{box-shadow:0 8px 28px rgba(220,38,38,0.35);}
      .btn-ai{background:linear-gradient(135deg,#5b21b6,#7c3aed,#a855f7);color:#fff;width:100%;padding:17px;font-size:16px;box-shadow:0 4px 24px rgba(124,58,237,0.3);animation:glow 2.5s ease-in-out infinite;}
      .btn-ai:not(:disabled):hover{animation:none;box-shadow:0 8px 36px rgba(124,58,237,0.5);}
      .btn-ghost{background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.2);color:#a78bfa;padding:9px 18px;font-size:13px;border-radius:10px;}
      .input{background:rgba(255,255,255,0.04);border:1px solid rgba(139,92,246,0.18);border-radius:12px;color:#ede8ff;font-family:'JetBrains Mono',monospace;font-size:20px;font-weight:600;padding:14px 18px;width:100%;outline:none;transition:all 0.2s;}
      .input:focus{border-color:rgba(139,92,246,0.5);box-shadow:0 0 0 3px rgba(139,92,246,0.08);}
      .input::placeholder{color:rgba(237,232,255,0.18);}
      .tab{padding:9px 16px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;border:none;transition:all 0.15s;font-family:'Outfit',sans-serif;}
      .tab-on{background:rgba(139,92,246,0.2);color:#c4b5fd;border:1px solid rgba(139,92,246,0.35);}
      .tab-off{background:transparent;color:rgba(237,232,255,0.28);border:1px solid transparent;}
      .tab-off:hover{color:rgba(237,232,255,0.55);}
      .chip{display:inline-flex;align-items:center;gap:5px;padding:4px 11px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;}
      .sp{width:15px;height:15px;border:2px solid rgba(255,255,255,0.25);border-top-color:#fff;border-radius:50%;display:inline-block;animation:spin 0.65s linear infinite;margin-right:7px;vertical-align:middle;}
      .mono{font-family:'JetBrains Mono',monospace;}
      .bar-track{height:8px;border-radius:999px;background:rgba(255,255,255,0.06);overflow:hidden;}
      .bar-fill{height:100%;background:linear-gradient(90deg,#047857,#34d399);border-radius:999px;transition:width 0.9s cubic-bezier(0.34,1.56,0.64,1);animation:barIn 1s ease-out;}
      .sbox{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);border-radius:13px;padding:14px;}
      .qbtn{flex:1;padding:8px 0;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid;transition:all 0.12s;font-family:'JetBrains Mono',monospace;}
      .toast{position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:300;padding:13px 22px;border-radius:14px;font-weight:600;font-size:14px;animation:slideD 0.25s ease;white-space:nowrap;pointer-events:none;}
      .t-ok{background:#052e16;border:1px solid #16a34a;color:#86efac;box-shadow:0 8px 32px rgba(22,163,74,0.2);}
      .t-err{background:#2d0a0a;border:1px solid #dc2626;color:#fca5a5;box-shadow:0 8px 32px rgba(220,38,38,0.2);}
      .hr{height:1px;background:linear-gradient(90deg,transparent,rgba(139,92,246,0.18),transparent);}
    `}</style>

    <Particles/>
    {toast && <div className={`toast ${toast.type==="success"?"t-ok":"t-err"}`}>{toast.msg}</div>}
    {showWallet && <WalletModal onConnect={handleConnect} onClose={()=>setShowWallet(false)}/>}
    <TxBar hash={txHash} status={txStatus} onClose={()=>{setTxHash(null);setTxStatus("");}}/>

    <div style={{position:"relative",zIndex:1,minHeight:"100vh",padding:"28px 16px 80px",display:"flex",flexDirection:"column",alignItems:"center"}}>

      {/* HEADER */}
      <div style={{width:"100%",maxWidth:520,marginBottom:26,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:38,height:38,borderRadius:11,background:"linear-gradient(135deg,#5b21b6,#a855f7)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,boxShadow:"0 4px 20px rgba(168,85,247,0.4)"}}>⚡</div>
          <div>
            <div style={{fontWeight:900,fontSize:17,letterSpacing:"-0.5px"}}>GENBET</div>
            <div style={{fontSize:10,color:"rgba(237,232,255,0.3)",fontWeight:600,letterSpacing:1,textTransform:"uppercase"}}>Bet on the Future</div>
          </div>
        </div>

        {account ? (
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{display:"flex",alignItems:"center",gap:7,background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:12,padding:"8px 14px"}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:"#10b981",boxShadow:"0 0 6px #10b981",animation:"pulse 2s infinite"}}/>
              <span className="mono" style={{fontSize:12,color:"#a5b4fc"}}>{short(account)}</span>
            </div>
            <button className="btn" onClick={disconnect} style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",color:"#f87171",padding:"8px 14px",fontSize:12,borderRadius:10}}>
              Disconnect
            </button>
          </div>
        ) : (
          <button className="btn" onClick={()=>setShowWallet(true)} style={{background:"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"#fff",padding:"10px 18px",fontSize:13,borderRadius:12,boxShadow:"0 4px 16px rgba(124,58,237,0.3)"}}>
            🦊 Connect Wallet
          </button>
        )}
      </div>

      {/* CONNECT PROMPT */}
      {!account && !loading && (
        <div className="card" style={{width:"100%",maxWidth:520,padding:24,marginBottom:14,textAlign:"center",border:"1px solid rgba(99,102,241,0.2)"}}>
          <div style={{fontSize:28,marginBottom:12}}>🦊</div>
          <div style={{fontWeight:700,fontSize:16,marginBottom:8}}>Connect wallet to participate</div>
          <div style={{fontSize:13,color:"rgba(237,232,255,0.4)",marginBottom:8,lineHeight:1.6}}>
            Connect MetaMask to place bets and resolve markets.
          </div>
          <div style={{fontSize:12,color:"#a78bfa",marginBottom:20}}>💡 No gas fees — GenLayer Studio is gasless</div>
          <button className="btn" onClick={()=>setShowWallet(true)} style={{background:"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"#fff",padding:"13px 28px",fontSize:14,borderRadius:13,boxShadow:"0 4px 20px rgba(124,58,237,0.3)"}}>
            Connect MetaMask
          </button>
        </div>
      )}

      {/* MARKET CARD */}
      <div className="card" style={{width:"100%",maxWidth:520,padding:26,marginBottom:14}}>
        {loading ? (
          <div style={{textAlign:"center",padding:"36px 0",color:"rgba(237,232,255,0.3)"}}>
            <div className="sp" style={{margin:"0 auto 12px",display:"block",width:22,height:22}}/>
            <div style={{fontSize:13}}>Loading market...</div>
          </div>
        ) : market && (<>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
            <span className="chip" style={{background:`${catClr(market.category)}18`,color:catClr(market.category),border:`1px solid ${catClr(market.category)}28`}}>
              {catIcon(market.category)} {market.category}
            </span>
            <span className="chip" style={{background:market.resolved?"rgba(16,185,129,0.12)":"rgba(168,85,247,0.12)",color:market.resolved?"#34d399":"#c084fc",border:`1px solid ${market.resolved?"rgba(16,185,129,0.25)":"rgba(168,85,247,0.25)"}`}}>
              {market.resolved?"✓ Resolved":"● Live"}
            </span>
          </div>

          <h2 style={{fontSize:20,fontWeight:800,lineHeight:1.35,marginBottom:22,color:"#f5f0ff",letterSpacing:"-0.3px"}}>
            {market.question}
          </h2>

          {market.resolved && (
            <div style={{background:market.outcome?"rgba(5,150,105,0.1)":"rgba(220,38,38,0.1)",border:`1px solid ${market.outcome?"rgba(5,150,105,0.3)":"rgba(220,38,38,0.3)"}`,borderRadius:16,padding:22,marginBottom:20,textAlign:"center"}}>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:1.5,color:market.outcome?"#6ee7b7":"#fca5a5",opacity:0.6,marginBottom:8}}>FINAL OUTCOME</div>
              <div style={{fontSize:42,fontWeight:900}}>{market.outcome?"✅ YES":"❌ NO"}</div>
              <div style={{fontSize:11,marginTop:8,color:"rgba(237,232,255,0.3)"}}>Resolved by AI · Optimistic Democracy</div>
            </div>
          )}

          <div style={{marginBottom:18}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
              <span style={{fontSize:13,fontWeight:700,color:"#34d399"}}>YES {yesPct}%</span>
              <span className="mono" style={{fontSize:11,color:"rgba(237,232,255,0.22)"}}>{totalPool} GEN total</span>
              <span style={{fontSize:13,fontWeight:700,color:"#f87171"}}>NO {noPct}%</span>
            </div>
            <div className="bar-track"><div className="bar-fill" style={{width:`${yesPct}%`}}/></div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
            {[
              {l:"YES Pool",v:`${toGEN(market.total_yes)}`,s:`${market.yes_odds}x odds`,c:"#34d399"},
              {l:"NO Pool", v:`${toGEN(market.total_no)}`, s:`${market.no_odds}x odds`, c:"#f87171"},
              {l:"Total",   v:totalPool,                   s:"GEN pool",                c:"#c084fc"},
            ].map(({l,v,s,c})=>(
              <div key={l} className="sbox" style={{textAlign:"center"}}>
                <div style={{fontSize:9,fontWeight:700,letterSpacing:1,color:c,opacity:0.55,textTransform:"uppercase",marginBottom:4}}>{l}</div>
                <div className="mono" style={{fontSize:14,fontWeight:700,color:c}}>{v}</div>
                <div style={{fontSize:10,color:"rgba(237,232,255,0.22)",marginTop:2}}>{s}</div>
              </div>
            ))}
          </div>
        </>)}
      </div>

      {/* ACTION CARD */}
      {!loading && market && !market.resolved && (
        <div className="card" style={{width:"100%",maxWidth:520,padding:26,marginBottom:14}}>
          <div style={{display:"flex",gap:8,marginBottom:20}}>
            {[["bet","🎯 Bet"],["resolve","⚡ Resolve"],["info","ℹ Info"]].map(([id,lbl])=>(
              <button key={id} className={`tab ${tab===id?"tab-on":"tab-off"}`} onClick={()=>setTab(id)}>{lbl}</button>
            ))}
          </div>
          <div className="hr" style={{marginBottom:20}}/>

          {/* BET */}
          {tab==="bet" && (<>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:1.5,color:"#7c3aed",textTransform:"uppercase",marginBottom:12}}>Bet Amount (GEN)</div>
            <input className="input" type="number" min="1" value={betAmt} onChange={e=>setBetAmt(e.target.value)} placeholder="100"/>

            <div style={{display:"flex",gap:8,margin:"12px 0 18px"}}>
              {["50","100","500","1000"].map(v=>(
                <button key={v} className="qbtn" onClick={()=>setBetAmt(v)} style={{
                  background:betAmt===v?"rgba(139,92,246,0.18)":"rgba(255,255,255,0.03)",
                  borderColor:betAmt===v?"rgba(139,92,246,0.4)":"rgba(255,255,255,0.07)",
                  color:betAmt===v?"#c4b5fd":"rgba(237,232,255,0.28)",
                }}>{v}</button>
              ))}
            </div>

            {Number(betAmt)>0 && (
              <div style={{background:"rgba(139,92,246,0.07)",border:"1px solid rgba(139,92,246,0.14)",borderRadius:12,padding:"13px 16px",marginBottom:18,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:9,color:"#6ee7b7",fontWeight:700,letterSpacing:1,marginBottom:5}}>WIN ON YES</div>
                  <div className="mono" style={{fontSize:18,fontWeight:700,color:"#34d399"}}>{yesWin} GEN</div>
                </div>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:9,color:"#fca5a5",fontWeight:700,letterSpacing:1,marginBottom:5}}>WIN ON NO</div>
                  <div className="mono" style={{fontSize:18,fontWeight:700,color:"#f87171"}}>{noWin} GEN</div>
                </div>
              </div>
            )}

            {!account && (
              <div style={{background:"rgba(99,102,241,0.08)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:12,padding:"12px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:16}}>🦊</span>
                <span style={{fontSize:13,color:"rgba(237,232,255,0.5)"}}>Connect wallet to place bets</span>
                <button className="btn" onClick={()=>setShowWallet(true)} style={{marginLeft:"auto",background:"rgba(99,102,241,0.2)",border:"1px solid rgba(99,102,241,0.3)",color:"#a5b4fc",padding:"6px 14px",fontSize:12,borderRadius:8}}>Connect</button>
              </div>
            )}

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <button className="btn btn-yes" disabled={!!busy||!account} onClick={()=>bet("yes")}>
                {busy==="yes"?<><span className="sp"/>Betting...</>:"✅ Bet YES"}
              </button>
              <button className="btn btn-no" disabled={!!busy||!account} onClick={()=>bet("no")}>
                {busy==="no"?<><span className="sp"/>Betting...</>:"❌ Bet NO"}
              </button>
            </div>
          </>)}

          {/* RESOLVE */}
          {tab==="resolve" && (<>
            <div style={{background:"rgba(124,58,237,0.07)",border:"1px solid rgba(124,58,237,0.18)",borderRadius:14,padding:18,marginBottom:20}}>
              <div style={{fontSize:12,fontWeight:700,color:"#a78bfa",marginBottom:10}}>How AI Resolution Works</div>
              {["Multiple validators fetch live data from the resolution URL","Each independently runs an LLM to determine YES or NO","Optimistic Democracy reaches consensus across all validators","Result is written on-chain permanently"].map((s,i)=>(
                <div key={i} style={{display:"flex",gap:10,marginBottom:8,alignItems:"flex-start"}}>
                  <span style={{color:"#7c3aed",fontWeight:700,fontSize:13,minWidth:18}}>{i+1}.</span>
                  <span style={{fontSize:13,color:"rgba(237,232,255,0.45)",lineHeight:1.5}}>{s}</span>
                </div>
              ))}
            </div>
            {!account && (
              <div style={{background:"rgba(99,102,241,0.08)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:12,padding:"12px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:16}}>🦊</span>
                <span style={{fontSize:13,color:"rgba(237,232,255,0.5)"}}>Connect wallet to resolve market</span>
                <button className="btn" onClick={()=>setShowWallet(true)} style={{marginLeft:"auto",background:"rgba(99,102,241,0.2)",border:"1px solid rgba(99,102,241,0.3)",color:"#a5b4fc",padding:"6px 14px",fontSize:12,borderRadius:8}}>Connect</button>
              </div>
            )}
            <button className="btn btn-ai" disabled={!!busy||!account} onClick={resolve}>
              {busy==="resolve"?<><span className="sp"/>AI Reaching Consensus...</>:"⚡ Resolve Market with AI"}
            </button>
          </>)}

          {/* INFO */}
          {tab==="info" && (<>
            {[
              ["Contract",    CONTRACT_ADDRESS],
              ["Network",     "GenLayer Studio"],
              ["Category",    market?.category||"—"],
              ["YES Odds",    `${market?.yes_odds}x multiplier`],
              ["NO Odds",     `${market?.no_odds}x multiplier`],
              ["Your Wallet", account?short(account):"Not connected"],
            ].map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                <span style={{fontSize:12,color:"rgba(237,232,255,0.3)",fontWeight:600}}>{l}</span>
                <span className="mono" style={{fontSize:11,color:"rgba(237,232,255,0.55)",maxWidth:230,textAlign:"right",wordBreak:"break-all"}}>{v}</span>
              </div>
            ))}
            <button className="btn btn-ghost" style={{width:"100%",marginTop:16,cursor:"pointer"}} onClick={load}>🔄 Refresh Market</button>
          </>)}
        </div>
      )}

      {!loading && market?.resolved && (
        <div className="card" style={{width:"100%",maxWidth:520,padding:22,textAlign:"center"}}>
          <div style={{fontSize:13,color:"rgba(237,232,255,0.35)",marginBottom:8}}>This market has been resolved by AI consensus.</div>
          <div className="mono" style={{fontSize:11,color:"rgba(237,232,255,0.2)",marginBottom:14}}>{CONTRACT_ADDRESS}</div>
          <button className="btn btn-ghost" style={{cursor:"pointer"}} onClick={load}>🔄 Refresh</button>
        </div>
      )}

      <div style={{marginTop:24,fontSize:11,color:"rgba(237,232,255,0.12)",letterSpacing:0.5,textAlign:"center"}}>
        GENBET · Built on GenLayer · Powered by AI
      </div>
    </div>
  </>);
}