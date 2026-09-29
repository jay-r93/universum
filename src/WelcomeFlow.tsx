import { useEffect, useState } from 'react';
import {
  Sparkles, Cloud, Smartphone, Mail, Lock, ArrowRight, ArrowLeft,
  Check, Download, Share, Eye, EyeOff, Shield,
} from 'lucide-react';
import type { StorageMode } from '@/lib/supabase';
import { signUpWithEmail, signInWithEmail } from '@/lib/supabase';

type UiLang = 'en' | 'de' | 'de-ch' | 'fr' | 'it' | 'es';
type ProtectionType = 'none' | 'pin' | 'password';

type Step = 'landing' | 'install' | 'auth-choice' | 'sign-in' | 'sign-up' | 'protection';

type OnboardingResult = {
  storageMode: StorageMode;
  email?: string;
  protection: ProtectionType;
  protectionValue: string;
  uiLang: UiLang;
};

type WelcomeFlowProps = {
  onComplete: (result: OnboardingResult) => void;
  uiLang: UiLang;
  setUiLang: (lang: UiLang) => void;
};

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const langLabels: Record<UiLang, { flag: string; name: string }> = {
  en: { flag: '🇬🇧', name: 'English' },
  de: { flag: '🇩🇪', name: 'Deutsch' },
  'de-ch': { flag: '🇨🇭', name: 'Schwiizertüütsch' },
  fr: { flag: '🇫🇷', name: 'Français' },
  it: { flag: '🇮🇹', name: 'Italiano' },
  es: { flag: '🇪🇸', name: 'Español' },
};

const flowStrings: Record<string, Record<UiLang, string>> = {
  tagline: {
    en: 'A quiet place for everything that matters to you.',
    de: 'Ein klarer Ort für Notizen, Projekte und die kleinen Dinge dazwischen.',
    'de-ch': 'E klare Ort für Notize, Projekt und die chliine Sache zwüschedrin.',
    fr: 'Un lieu clair pour vos notes, projets et les petites choses entre deux.',
    it: 'Un luogo chiaro per note, progetti e le piccole cose in mezzo.',
    es: 'Un lugar claro para notas, proyectos y las pequeñas cosas entre medias.',
  },
  start: { en: 'Get started', de: 'Loslegen', 'de-ch': 'Loslee', fr: 'Commencer', it: 'Inizia', es: 'Empezar' },
  installTitle: { en: 'Install as app', de: 'Als App installieren', 'de-ch': 'Als App installiere', fr: 'Installer comme app', it: 'Installa come app', es: 'Instalar como app' },
  installDesc: { en: 'Keep Universe on your home screen — offline, no browser bar, just like a real app.', de: 'Behalte Universe auf deinem Homescreen — offline, ohne Browser-Leiste, wie eine richtige App.', 'de-ch': 'Behalt Universe uf dim Home-Screen — offline, ohni Browser-Leischte, wie e richtigi App.', fr: 'Gardez Universe sur votre écran d\'accueil — hors ligne, sans barre de navigateur.', it: 'Mantieni Universe sulla tua schermata home — offline, senza barra del browser.', es: 'Mantén Universe en tu pantalla de inicio — sin conexión, sin barra del navegador.' },
  install: { en: 'Install app', de: 'App installieren', 'de-ch': 'App installiere', fr: 'Installer l\'app', it: 'Installa app', es: 'Instalar app' },
  skipInstall: { en: 'Continue in browser', de: 'Im Browser weitermachen', 'de-ch': 'Im Browser wiitermache', fr: 'Continuer dans le navigateur', it: 'Continua nel browser', es: 'Continuar en el navegador' },
  iosHint: { en: 'On iPhone: tap the Share button below, then "Add to Home Screen".', de: 'Auf dem iPhone: tippe auf Teilen unten, dann "Zum Home-Bildschirm".', 'de-ch': 'Ufem iPhone: tippe uf Teile unde, denn "Zum Home-Bildschirm".', fr: 'Sur iPhone : appuyez sur Partager, puis "Sur l\'écran d\'accueil".', it: 'Su iPhone: tocca Condividi, poi "Aggiungi a schermata Home".', es: 'En iPhone: toca Compartir, luego "Añadir a pantalla de inicio".' },
  androidHint: { en: 'In the browser menu: "Add to Home screen" or "Install app".', de: 'Im Browser-Menü: "Zum Startbildschirm hinzufügen" oder "App installieren".', 'de-ch': 'Im Browser-Menü: "Zum Startbildschirm zuefüege" oder "App installiere".', fr: 'Dans le menu du navigateur : "Ajouter à l\'écran d\'accueil".', it: 'Nel menu del browser: "Aggiungi a schermata Home".', es: 'En el menú del navegador: "Añadir a pantalla de inicio".' },
  authTitle: { en: 'How do you want to save?', de: 'Wie möchtest du speichern?', 'de-ch': 'Wie wotsch du speichere?', fr: 'Comment voulez-vous sauvegarder?', it: 'Come vuoi salvare?', es: '¿Cómo quieres guardar?' },
  authDesc: { en: 'Your notes stay safe. Choose whether to keep them on this device only or in the cloud for access everywhere.', de: 'Deine Notizen bleiben sicher. Wähle, ob du sie nur auf diesem Gerät behältst oder in der Cloud für Zugriff von überall.', 'de-ch': 'Dini Notize bliibe sicher. Wähl, ob du sie nur uf dem Gerät behaltsch oder i der Cloud für Zugriff vo überall.', fr: 'Vos notes restent en sécurité. Choisissez de les garder sur cet appareil ou dans le cloud.', it: 'Le tue note restano al sicuro. Scegli se tenerle solo su questo dispositivo o nel cloud.', es: 'Tus notas están seguras. Elige si guardarlas solo en este dispositivo o en la nube.' },
  cloudTitle: { en: 'With cloud account', de: 'Mit Cloud-Konto', 'de-ch': 'Mit Cloud-Konto', fr: 'Avec compte cloud', it: 'Con account cloud', es: 'Con cuenta en la nube' },
  cloudDesc: { en: 'Email & password · Access from anywhere · Automatic backup', de: 'E-Mail & Passwort · Zugriff von überall · Automatische Sicherung', 'de-ch': 'E-Mail & Passwort · Zugriff vo überall · Automatischi Sicherig', fr: 'E-mail et mot de passe · Accès de partout · Sauvegarde automatique', it: 'Email e password · Accesso da ovunque · Backup automatico', es: 'Email y contraseña · Acceso desde cualquier lugar · Copia automática' },
  localTitle: { en: 'On this device only', de: 'Nur auf diesem Gerät', 'de-ch': 'Nur uf dem Gerät', fr: 'Sur cet appareil uniquement', it: 'Solo su questo dispositivo', es: 'Solo en este dispositivo' },
  localDesc: { en: 'No account needed · Local storage · Private & offline', de: 'Kein Konto nötig · Lokale Speicher · Privat & offline', 'de-ch': 'Keis Konto nötig · Lokale Speicher · Privat & offline', fr: 'Aucun compte nécessaire · Stockage local · Privé et hors ligne', it: 'Nessun account necessario · Archiviazione locale · Privato e offline', es: 'Sin cuenta necesaria · Almacenamiento local · Privado y sin conexión' },
  signInTitle: { en: 'Welcome back', de: 'Willkommen zurück', 'de-ch': 'Willcho zrugg', fr: 'Bon retour', it: 'Bentornato', es: 'Bienvenido de nuevo' },
  signInDesc: { en: 'Sign in to load your notes from the cloud.', de: 'Melde dich an, um deine Notizen aus der Cloud zu laden.', 'de-ch': 'Melde dich aa, zum dini Notize us der Cloud lade.', fr: 'Connectez-vous pour charger vos notes depuis le cloud.', it: 'Accedi per caricare le tue note dal cloud.', es: 'Inicia sesión para cargar tus notas desde la nube.' },
  signUpTitle: { en: 'Create cloud account', de: 'Cloud-Konto erstellen', 'de-ch': 'Cloud-Konto erstelle', fr: 'Créer un compte cloud', it: 'Crea account cloud', es: 'Crear cuenta en la nube' },
  signUpDesc: { en: 'Create a free account for cloud sync and access from anywhere.', de: 'Erstelle ein kostenloses Konto für Cloud-Sync und Zugriff von überall.', 'de-ch': 'Erstell e kostenloses Konto für Cloud-Sync und Zugriff vo überall.', fr: 'Créez un compte gratuit pour la synchronisation cloud.', it: 'Crea un account gratuito per la sincronizzazione cloud.', es: 'Crea una cuenta gratuita para la sincronización en la nube.' },
  email: { en: 'Email address', de: 'E-Mail-Adresse', 'de-ch': 'E-Mail-Adrässe', fr: 'Adresse e-mail', it: 'Indirizzo email', es: 'Dirección de email' },
  password: { en: 'Password', de: 'Passwort', 'de-ch': 'Passwort', fr: 'Mot de passe', it: 'Password', es: 'Contraseña' },
  passwordHint: { en: 'At least 6 characters', de: 'Mindestens 6 Zeichen', 'de-ch': 'Mindeschens 6 Zeiche', fr: 'Au moins 6 caractères', it: 'Almeno 6 caratteri', es: 'Al menos 6 caracteres' },
  signInBtn: { en: 'Sign in', de: 'Anmelden', 'de-ch': 'Amälde', fr: 'Se connecter', it: 'Accedi', es: 'Iniciar sesión' },
  signUpBtn: { en: 'Create account', de: 'Konto erstellen', 'de-ch': 'Konto erstelle', fr: 'Créer un compte', it: 'Crea account', es: 'Crear cuenta' },
  noAccount: { en: "Don't have an account? Sign up", de: 'Noch kein Konto? Jetzt registrieren', 'de-ch': 'No keis Konto? Jetz registriere', fr: 'Pas de compte ? S\'inscrire', it: 'Non hai un account? Registrati', es: '¿No tienes cuenta? Regístrate' },
  haveAccount: { en: 'Already have an account? Sign in', de: 'Schon ein Konto? Anmelden', 'de-ch': 'Scho e Konto? Amälde', fr: 'Déjà un compte ? Se connecter', it: 'Hai già un account? Accedi', es: '¿Ya tienes cuenta? Inicia sesión' },
  protTitle: { en: 'Protect your universe', de: 'Schütze dein Universum', 'de-ch': 'Schütz dis Universum', fr: 'Protégez votre univers', it: 'Proteggi il tuo universo', es: 'Protege tu universo' },
  protDesc: { en: 'Add a PIN or password so only you can open your notes.', de: 'Lege eine PIN oder ein Passwort fest, damit nur du deine Notizen öffnen kannst.', 'de-ch': 'Leg e PIN oder es Passwort fest, dammit nur du dini Notize chasch öffne.', fr: 'Ajoutez un code PIN ou un mot de passe pour protéger vos notes.', it: 'Aggiungi un PIN o una password per proteggere le tue note.', es: 'Añade un PIN o contraseña para que solo tú puedas abrir tus notas.' },
  skipProtection: { en: 'Skip for now', de: 'Vorerst überspringen', 'de-ch': 'Vorerst überspringe', fr: 'Passer pour l\'instant', it: 'Salta per ora', es: 'Saltar por ahora' },
  pinBtn: { en: 'Set PIN code', de: 'PIN-Code festlegen', 'de-ch': 'PIN-Code festlege', fr: 'Définir un code PIN', it: 'Imposta PIN', es: 'Establecer PIN' },
  pwdBtn: { en: 'Set password', de: 'Passwort festlegen', 'de-ch': 'Passwort festlege', fr: 'Définir un mot de passe', it: 'Imposta password', es: 'Establecer contraseña' },
  pinPlaceholder: { en: '4-6 digits', de: '4-6 Ziffern', 'de-ch': '4-6 Ziffere', fr: '4-6 chiffres', it: '4-6 cifre', es: '4-6 dígitos' },
  pwdPlaceholder: { en: 'Password', de: 'Passwort', 'de-ch': 'Passwort', fr: 'Mot de passe', it: 'Password', es: 'Contraseña' },
  confirm: { en: 'Confirm', de: 'Bestätigen', 'de-ch': 'Bestätige', fr: 'Confirmer', it: 'Conferma', es: 'Confirmar' },
  continue: { en: 'Continue', de: 'Weiter', 'de-ch': 'Wiiter', fr: 'Continuer', it: 'Continua', es: 'Continuar' },
  busy: { en: 'Please wait…', de: 'Bitte warten…', 'de-ch': 'Bitte warte…', fr: 'Veuillez patienter…', it: 'Attendi…', es: 'Por favor espera…' },
  back: { en: 'Back', de: 'Zurück', 'de-ch': 'Zrugg', fr: 'Retour', it: 'Indietro', es: 'Atrás' },
  installed: { en: 'App installed — you can open it from your home screen.', de: 'App installiert — du kannst sie vom Homescreen öffnen.', 'de-ch': 'App installiert — du chasch sie vom Home-Screen öffne.', fr: 'App installée — vous pouvez l\'ouvrir depuis l\'écran d\'accueil.', it: 'App installata — puoi aprirla dalla schermata home.', es: 'App instalada — puedes abrirla desde la pantalla de inicio.' },
};

function tr(key: string, lang: UiLang): string {
  return flowStrings[key]?.[lang] ?? flowStrings[key]?.en ?? key;
}

export function WelcomeFlow({ onComplete, uiLang, setUiLang }: WelcomeFlowProps) {
  const [step, setStep] = useState<Step>('landing');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [protectionType, setProtectionType] = useState<ProtectionType>('none');
  const [protectionValue, setProtectionValue] = useState('');
  const [cloudEmail, setCloudEmail] = useState<string | undefined>(undefined);

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setInstallEvent(e as BeforeInstallPromptEvent); };
    window.addEventListener('beforeinstallprompt', handler);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) setInstalled(true);
    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent) && !('BeforeInstallPromptEvent' in window));
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const lang: UiLang = uiLang;
  const langs: UiLang[] = ['en', 'de', 'de-ch', 'fr', 'it', 'es'];

  const handleInstall = async () => {
    if (installEvent) {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === 'accepted') setInstalled(true);
      setInstallEvent(null);
    } else {
      setInstalled(true);
    }
    setStep('auth-choice');
  };

  const handleAuth = async (mode: 'sign-in' | 'sign-up') => {
    if (!email.trim() || !password) { setError(tr('email', lang) + ' & ' + tr('password', lang)); return; }
    if (password.length < 6) { setError(tr('passwordHint', lang)); return; }
    setBusy(true); setError('');
    try {
      const fn = mode === 'sign-in' ? signInWithEmail : signUpWithEmail;
      const result = await fn(email.trim(), password);
      if (result.error) {
        // Never surface the provider's message: it distinguishes "this address
        // already has an account" from "it does not", which lets anyone test
        // whether a given person uses this app. Both outcomes read the same.
        setError(mode === 'sign-in'
          ? 'E-Mail oder Passwort stimmt nicht.'
          : 'Registrierung nicht möglich. Bitte prüfe deine E-Mail-Adresse und versuche es erneut.');
        return;
      }
      setCloudEmail(email.trim());
      setStep('protection');
    } catch {
      setError('Verbindung nicht möglich. Bitte versuche es später erneut.');
    } finally { setBusy(false); }
  };

  const finishOnboarding = (prot: ProtectionType, val: string) => {
    onComplete({
      storageMode: cloudEmail ? 'cloud' : 'local',
      email: cloudEmail,
      protection: prot,
      protectionValue: val,
      uiLang: lang,
    });
  };

  return (
    <div className="welcome-flow">
      <div className="welcome-card">
        {step === 'landing' && (
          <div className="welcome-landing">
            <div className="welcome-hero">
              <div className="welcome-orb"><Sparkles size={32} /></div>
              <h1 className="welcome-title">Dein persönliches Universum</h1>
              <p className="welcome-tagline">{tr('tagline', lang)}</p>
            </div>
            <div className="welcome-lang-row">
              {langs.map((l) => (
                <button key={l} className={`lang-chip ${lang === l ? 'active' : ''}`} onClick={() => setUiLang(l)}>
                  <span className="lang-flag">{langLabels[l].flag}</span>
                  <span>{langLabels[l].name}</span>
                </button>
              ))}
            </div>
            <button className="welcome-cta" onClick={() => setStep('install')}>
              {tr('start', lang)} <ArrowRight size={18} />
            </button>
          </div>
        )}

        {step === 'install' && (
          <div className="welcome-step">
            <div className="welcome-icon-wrap"><Download size={30} /></div>
            <h2 className="welcome-heading">{tr('installTitle', lang)}</h2>
            <p className="welcome-desc">{tr('installDesc', lang)}</p>
            <div className="welcome-actions">
              {installEvent ? (
                <button className="welcome-primary" onClick={() => void handleInstall()}>
                  <Download size={18} /> {tr('install', lang)}
                </button>
              ) : isIOS ? (
                <>
                  <p className="welcome-hint"><Share size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> {tr('iosHint', lang)}</p>
                  <button className="welcome-primary" onClick={() => { setInstalled(true); setStep('auth-choice'); }}>
                    <Check size={18} /> {tr('continue', lang)}
                  </button>
                </>
              ) : (
                <>
                  <p className="welcome-hint">{tr('androidHint', lang)}</p>
                  <button className="welcome-primary" onClick={() => { setInstalled(true); setStep('auth-choice'); }}>
                    <Check size={18} /> {tr('continue', lang)}
                  </button>
                </>
              )}
              <button className="welcome-secondary" onClick={() => setStep('auth-choice')}>
                {tr('skipInstall', lang)} <ArrowRight size={16} />
              </button>
            </div>
            {installed && <p className="welcome-hint" style={{ color: 'var(--forest)' }}><Check size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> {tr('installed', lang)}</p>}
          </div>
        )}

        {step === 'auth-choice' && (
          <div className="welcome-step">
            <div className="welcome-icon-wrap"><Sparkles size={30} /></div>
            <h2 className="welcome-heading">{tr('authTitle', lang)}</h2>
            <p className="welcome-desc">{tr('authDesc', lang)}</p>
            <div className="welcome-choice-list">
              <button className="welcome-choice" onClick={() => setStep('sign-up')}>
                <div className="welcome-choice-icon"><Cloud size={22} /></div>
                <div className="welcome-choice-body">
                  <strong>{tr('cloudTitle', lang)}</strong>
                  <span>{tr('cloudDesc', lang)}</span>
                </div>
                <ArrowRight size={18} className="welcome-choice-arrow" />
              </button>
              <button className="welcome-choice" onClick={() => { setCloudEmail(undefined); setStep('protection'); }}>
                <div className="welcome-choice-icon"><Smartphone size={22} /></div>
                <div className="welcome-choice-body">
                  <strong>{tr('localTitle', lang)}</strong>
                  <span>{tr('localDesc', lang)}</span>
                </div>
                <ArrowRight size={18} className="welcome-choice-arrow" />
              </button>
            </div>
          </div>
        )}

        {(step === 'sign-in' || step === 'sign-up') && (
          <div className="welcome-step">
            <button className="welcome-back" onClick={() => setStep('auth-choice')}><ArrowLeft size={14} /> {tr('back', lang)}</button>
            <div className="welcome-icon-wrap">{step === 'sign-in' ? <Cloud size={28} /> : <Sparkles size={28} />}</div>
            <h2 className="welcome-heading">{step === 'sign-in' ? tr('signInTitle', lang) : tr('signUpTitle', lang)}</h2>
            <p className="welcome-desc">{step === 'sign-in' ? tr('signInDesc', lang) : tr('signUpDesc', lang)}</p>
            <div className="welcome-form">
              <div className="welcome-input-group">
                <Mail size={16} className="welcome-input-icon" />
                <input className="welcome-input" type="email" placeholder={tr('email', lang)} value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
              </div>
              <div className="welcome-input-group">
                <Lock size={16} className="welcome-input-icon" />
                <input className="welcome-input" type={showPwd ? 'text' : 'password'} placeholder={tr('password', lang)} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void handleAuth(step); }} />
                <button className="welcome-eye" onClick={() => setShowPwd((v) => !v)}>{showPwd ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
              {error && <div className="welcome-error">{error}</div>}
              <button className="welcome-primary" onClick={() => void handleAuth(step)} disabled={busy}>
                {busy ? tr('busy', lang) : <>{step === 'sign-in' ? tr('signInBtn', lang) : tr('signUpBtn', lang)} <ArrowRight size={18} /></>}
              </button>
              <button className="welcome-link" onClick={() => setStep(step === 'sign-in' ? 'sign-up' : 'sign-in')}>
                {step === 'sign-in' ? tr('noAccount', lang) : tr('haveAccount', lang)}
              </button>
            </div>
          </div>
        )}

        {step === 'protection' && (
          <div className="welcome-step">
            {cloudEmail && <button className="welcome-back" onClick={() => setStep('auth-choice')}><ArrowLeft size={14} /> {tr('back', lang)}</button>}
            <div className="welcome-icon-wrap"><Shield size={28} /></div>
            <h2 className="welcome-heading">{tr('protTitle', lang)}</h2>
            <p className="welcome-desc">{tr('protDesc', lang)}</p>
            {protectionType === 'none' ? (
              <div className="welcome-choice-list">
                <button className="welcome-choice" onClick={() => setProtectionType('pin')}>
                  <div className="welcome-choice-icon"><Lock size={20} /></div>
                  <div className="welcome-choice-body"><strong>{tr('pinBtn', lang)}</strong></div>
                  <ArrowRight size={18} className="welcome-choice-arrow" />
                </button>
                <button className="welcome-choice" onClick={() => setProtectionType('password')}>
                  <div className="welcome-choice-icon"><Shield size={20} /></div>
                  <div className="welcome-choice-body"><strong>{tr('pwdBtn', lang)}</strong></div>
                  <ArrowRight size={18} className="welcome-choice-arrow" />
                </button>
                <button className="welcome-secondary" onClick={() => finishOnboarding('none', '')}>
                  {tr('skipProtection', lang)} <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              <div className="welcome-form">
                <div className="welcome-input-group">
                  <Lock size={16} className="welcome-input-icon" />
                  <input
                    className="welcome-input standalone"
                    type={protectionType === 'pin' || !showPwd ? 'password' : 'text'}
                    placeholder={protectionType === 'pin' ? tr('pinPlaceholder', lang) : tr('pwdPlaceholder', lang)}
                    value={protectionValue}
                    onChange={(e) => setProtectionValue(protectionType === 'pin' ? e.target.value.replace(/\D/g, '').slice(0, 6) : e.target.value.slice(0, 20))}
                    onKeyDown={(e) => { if (e.key === 'Enter') { if (protectionType === 'pin' && /^\d{4,6}$/.test(protectionValue)) finishOnboarding('pin', protectionValue); else if (protectionType === 'password' && protectionValue.trim()) finishOnboarding('password', protectionValue.trim()); } }}
                    autoFocus
                    style={{ letterSpacing: protectionType === 'pin' ? '0.3em' : 'normal' }}
                  />
                  {protectionType === 'password' && <button className="welcome-eye" onClick={() => setShowPwd((v) => !v)}>{showPwd ? <EyeOff size={16} /> : <Eye size={16} />}</button>}
                </div>
                {protectionType === 'pin' && protectionValue.length > 0 && !/^\d{4,6}$/.test(protectionValue) && <div className="welcome-error">{tr('pinPlaceholder', lang)}</div>}
                <div className="welcome-actions">
                  <button
                    className="welcome-primary"
                    onClick={() => {
                      if (protectionType === 'pin' && /^\d{4,6}$/.test(protectionValue)) finishOnboarding('pin', protectionValue);
                      else if (protectionType === 'password' && protectionValue.trim()) finishOnboarding('password', protectionValue.trim());
                    }}
                    disabled={(protectionType === 'pin' && !/^\d{4,6}$/.test(protectionValue)) || (protectionType === 'password' && !protectionValue.trim())}
                  >
                    <Check size={18} /> {tr('confirm', lang)}
                  </button>
                  <button className="welcome-secondary" onClick={() => setProtectionType('none')}>{tr('back', lang)}</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
