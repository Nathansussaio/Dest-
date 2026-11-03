/* Entrada: boas-vindas, entrar, criar conta, confirmar e-mail, recuperar senha */
import React, { useState } from 'react';
import { View, Linking } from 'react-native';
import { useApp, setState } from '../store/store';
import * as A from '../store/actions';
import { Logo, T, Btn, LinkBtn, Field, Input, Row, Gap, Cover, Card, Note, Icon, Check, Screen, TopBar, IconBtn } from '../ui';
import { useTheme, useSiteWide } from '../theme/useTheme';
import { passRules, passStrength } from '../lib/auth';
import { destName } from '../data';
import { CLOUD_ENABLED, PRIVACY_URL, TERMS_URL } from '../config';

const goAuth = (auth: 'welcome' | 'login' | 'signup' | 'verify' | 'forgot') => setState({ auth });

/* Telas de entrada: no site em tela larga, painel da marca à esquerda e o formulário à direita */
function AuthShell({ children }: { children: React.ReactNode }) {
  const wide = useSiteWide();
  if (!wide) return <Screen tabs={false}>{children}</Screen>;
  const points = ['Roteiro dia a dia no seu estilo', 'Orçamento e divisão de gastos do grupo', 'Reservas, clima e o que levar', 'Suas viagens salvas na sua conta'];
  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      <View style={{ flex: 1, backgroundColor: '#0B6670', padding: 56, justifyContent: 'center', gap: 22, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', right: -120, top: -120, width: 420, height: 420, borderRadius: 210, backgroundColor: 'rgba(255,255,255,0.07)' }} />
        <Logo size={44} textSize={34} color="#FFFFFF" />
        <T v="big" color="#FFFFFF" style={{ maxWidth: 520 }}>Planeje viagens sem planilha.</T>
        <View style={{ gap: 12 }}>
          {points.map((p) => <Row key={p} gap={10}><Icon name="check" size={18} color="#8FD3DA" strokeWidth={2.4} /><T v="body" color="rgba(255,255,255,0.92)">{p}</T></Row>)}
        </View>
        <Row gap={14} style={{ marginTop: 12 }}>
          {['lisboa', 'kyoto', 'rio', 'paris'].map((id) => (
            <Cover key={id} destId={id} height={120} artW={90} artTop={18} artRight={-6} radius={14}>
              <View style={{ width: 96 }} />
              <View style={{ position: 'absolute', left: 10, bottom: 8 }}><T v="small" color="#FFFFFF" style={{ fontWeight: '700' }}>{destName(id)}</T></View>
            </Cover>
          ))}
        </Row>
      </View>
      <View style={{ flex: 1 }}>
        <Screen tabs={false}>
          <View style={{ maxWidth: 480, width: '100%', alignSelf: 'center', paddingTop: 24 }}>{children}</View>
        </Screen>
      </View>
    </View>
  );
}

export function Welcome() {
  const fan = ['lisboa', 'kyoto', 'rio'];
  return (
    <Screen tabs={false}>
      <View style={{ alignItems: 'center', marginTop: 4, marginBottom: 6 }}><Logo size={56} textSize={44} /></View>
      <View style={{ height: 300, alignItems: 'center', justifyContent: 'center', marginTop: 8 }}>
        {fan.map((id, i) => (
          <View key={id} style={{ position: 'absolute', transform: [{ rotate: (i - 1) * 9 + 'deg' }, { translateX: (i - 1) * 70 }, { translateY: i === 1 ? -10 : 14 }], zIndex: i === 1 ? 2 : 1 }}>
            <Cover destId={id} height={230} artW={150} artTop={70} artRight={-10} radius={22}>
              <View style={{ width: 160 }} />
              <View style={{ position: 'absolute', left: 14, bottom: 14 }}><T v="lt" color="#FFFFFF">{destName(id)}</T></View>
            </Cover>
          </View>
        ))}
      </View>
      <Gap h={18} />
      <T v="big">Planeje viagens sem planilha.</T>
      <Gap h={10} />
      <T v="muted">Roteiro dia a dia, orçamento, reservas e dicas do destino num só lugar.</T>
      <Gap h={26} />
      <Btn label="Criar conta" onPress={() => goAuth('signup')} block />
      <Gap h={10} />
      <Btn kind="secondary" label="Já tenho conta" onPress={() => goAuth('login')} block />
      <Gap h={14} />
      <View style={{ alignItems: 'center' }}><LinkBtn label="Experimentar sem conta" onPress={A.tryAsGuest} /></View>
      <Gap h={8} />
      <Legal />
    </Screen>
  );
}

/* Links para a Política de privacidade e os Termos de uso (exigidos pelas lojas) */
function Legal() {
  return (
    <Row gap={2} style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
      <LinkBtn label="Privacidade" onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})} />
      <T v="smallMuted">·</T>
      <LinkBtn label="Termos de uso" onPress={() => Linking.openURL(TERMS_URL).catch(() => {})} />
    </Row>
  );
}

export function Login() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const submit = async () => { if (busy) return; setBusy(true); const e = await A.login(email, pass); setBusy(false); setErr(e); };
  return (
    <AuthShell>
      <TopBar title="" onBack={() => goAuth('welcome')} />
      <T v="h1">Entrar</T>
      <Gap h={6} />
      <T v="muted">Que bom ter você de volta.</T>
      <Gap h={24} />
      {err.form ? <Note kind="err" style={{ marginBottom: 16 }}>{err.form}</Note> : null}
      <Field label="E-mail" error={err.email}>
        <Input value={email} onChangeText={setEmail} placeholder="voce@email.com" keyboard="email-address" caps="none" autoComplete="email" error={!!err.email} />
      </Field>
      <Field label="Senha" error={err.pass}>
        <Input value={pass} onChangeText={setPass} placeholder="Sua senha" secure={!show} caps="none" autoComplete="password" error={!!err.pass} onSubmit={submit}
          right={<IconBtn icon={show ? 'eyeOff' : 'eye'} label={show ? 'Esconder senha' : 'Mostrar senha'} glass size={44} onPress={() => setShow(!show)} />} />
      </Field>
      {CLOUD_ENABLED ? <View style={{ alignItems: 'flex-end', marginTop: -10, marginBottom: 14 }}><LinkBtn label="Esqueci a senha" onPress={() => goAuth('forgot')} /></View> : null}
      <Btn label={busy ? 'Entrando…' : 'Entrar'} onPress={submit} disabled={busy} block />
      <Gap h={18} />
      <Row gap={4} style={{ justifyContent: 'center' }}><T v="smallMuted">Não tem conta?</T><LinkBtn label="Criar conta" onPress={() => goAuth('signup')} /></Row>
    </AuthShell>
  );
}

export function Signup() {
  const { c } = useTheme();
  const s = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [terms, setTerms] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const rules = passRules(pass), str = passStrength(pass);
  const strLabel = ['', 'Fraca', 'Média', 'Forte'][str], strCol = ['', c.errText, c.warnText, c.acc][str];
  const submit = async () => { if (busy) return; setBusy(true); setErr(await A.signup(name, email, pass, pass2, terms)); setBusy(false); };
  return (
    <AuthShell>
      <TopBar title="" onBack={() => goAuth('welcome')} />
      <T v="h1">Criar conta</T>
      <Gap h={6} />
      <T v="muted">{s.pendingGuest ? 'As viagens que você montou como visitante vêm junto.' : CLOUD_ENABLED ? 'Suas viagens ficam guardadas na sua conta e aparecem em qualquer celular.' : 'Leva menos de um minuto.'}</T>
      <Gap h={24} />
      {err.form ? <Note kind="err" style={{ marginBottom: 16 }}>{err.form}</Note> : null}
      <Field label="Nome" error={err.name}><Input value={name} onChangeText={setName} placeholder="Como quer ser chamado" caps="words" autoComplete="name" error={!!err.name} /></Field>
      <Field label="E-mail" error={err.email}><Input value={email} onChangeText={setEmail} placeholder="voce@email.com" keyboard="email-address" caps="none" autoComplete="email" error={!!err.email} /></Field>
      <Field label="Senha" error={err.pass}>
        <Input value={pass} onChangeText={setPass} placeholder="Crie uma senha" secure caps="none" autoComplete="new-password" error={!!err.pass} />
        {pass ? (
          <View style={{ marginTop: 10, gap: 4 }}>
            <T v="small" color={strCol} style={{ fontWeight: '700' }}>{'Força: ' + strLabel}</T>
            {rules.map((r) => (
              <Row key={r.label} gap={6}><Icon name={r.ok ? 'check' : 'dot'} size={14} color={r.ok ? c.acc : c.muted2} /><T v="smallMuted" color={r.ok ? c.ink : undefined}>{r.label}</T></Row>
            ))}
          </View>
        ) : null}
      </Field>
      <Field label="Confirme a senha" error={err.pass2}><Input value={pass2} onChangeText={setPass2} placeholder="Repita a senha" secure caps="none" autoComplete="new-password" error={!!err.pass2} /></Field>
      <Card flat style={{ marginBottom: err.terms ? 6 : 8 }}>
        <Check on={terms} onPress={() => setTerms(!terms)} label="Aceito os Termos de uso e a Política de privacidade" />
      </Card>
      {err.terms ? <T v="small" color={c.errText} style={{ marginBottom: 8 }}>{err.terms}</T> : null}
      <Legal />
      <Gap h={8} />
      <Btn label={busy ? 'Criando…' : 'Continuar'} onPress={submit} disabled={busy} block />
      <Gap h={18} />
      <Row gap={4} style={{ justifyContent: 'center' }}><T v="smallMuted">Já tem conta?</T><LinkBtn label="Entrar" onPress={() => goAuth('login')} /></Row>
    </AuthShell>
  );
}

export function Verify() {
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (v = code) => { if (busy) return; setBusy(true); setErr(await A.verifyCode(v)); setBusy(false); };
  return (
    <AuthShell>
      <TopBar title="" onBack={() => goAuth('signup')} />
      <T v="h1">Confirme seu e-mail</T>
      <Gap h={6} />
      <T v="muted">{'Enviamos um código de 6 números para ' + A.pendingEmail() + '. Confira também a caixa de spam.'}</T>
      <Gap h={24} />
      <Field label="Código" error={err}>
        <Input value={code} maxLength={6} keyboard="number-pad" placeholder="000000" caps="none" autoComplete="one-time-code" error={!!err}
          onChangeText={(v) => { const d = v.replace(/\D/g, '').slice(0, 6); setCode(d); if (d.length === 6) submit(d); }} />
      </Field>
      <Btn label={busy ? 'Confirmando…' : 'Confirmar'} onPress={() => submit()} disabled={busy} block />
      <Gap h={10} />
      <View style={{ alignItems: 'center' }}><LinkBtn label="Reenviar código" onPress={A.resendCode} /></View>
    </AuthShell>
  );
}

export function Forgot() {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [code, setCode] = useState('');
  const [nw, setNw] = useState('');
  const [nw2, setNw2] = useState('');
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (busy) return; setBusy(true);
    const e = await A.sendReset(email); setBusy(false);
    if (e) setErr({ email: e }); else { setErr({}); setStep(2); }
  };
  const confirm = async () => { if (busy) return; setBusy(true); setErr(await A.confirmReset(email, code, nw, nw2)); setBusy(false); };
  return (
    <AuthShell>
      <TopBar title="" onBack={() => (step === 2 ? setStep(1) : goAuth('login'))} />
      <T v="h1">Recuperar senha</T>
      <Gap h={6} />
      <T v="muted">{step === 1 ? 'Informe o e-mail da conta. Enviaremos um código para você criar uma senha nova.' : 'Digite o código enviado para ' + email.trim() + ' e escolha a senha nova.'}</T>
      <Gap h={24} />
      {err.form ? <Note kind="err" style={{ marginBottom: 16 }}>{err.form}</Note> : null}
      {step === 1 ? (
        <>
          <Field label="E-mail" error={err.email}><Input value={email} onChangeText={setEmail} placeholder="voce@email.com" keyboard="email-address" caps="none" autoComplete="email" error={!!err.email} /></Field>
          <Btn label={busy ? 'Enviando…' : 'Enviar código'} disabled={busy} block onPress={send} />
        </>
      ) : (
        <>
          <Field label="Código" error={err.code}><Input value={code} maxLength={6} keyboard="number-pad" placeholder="000000" caps="none" autoComplete="one-time-code" error={!!err.code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} /></Field>
          <Field label="Senha nova" error={err.nw}><Input value={nw} onChangeText={setNw} secure caps="none" autoComplete="new-password" error={!!err.nw} /></Field>
          <Field label="Confirme a senha nova" error={err.nw2}><Input value={nw2} onChangeText={setNw2} secure caps="none" autoComplete="new-password" error={!!err.nw2} /></Field>
          <Btn label={busy ? 'Salvando…' : 'Salvar senha nova'} disabled={busy} block onPress={confirm} />
          <Gap h={10} />
          <View style={{ alignItems: 'center' }}><LinkBtn label="Reenviar código" onPress={send} /></View>
        </>
      )}
    </AuthShell>
  );
}

export function AuthRouter() {
  const a = useApp().auth;
  if (a === 'login') return <Login />;
  if (a === 'signup') return <Signup />;
  if (a === 'verify') return <Verify />;
  if (a === 'forgot') return <Forgot />;
  return <Welcome />;
}
