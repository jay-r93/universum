import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clipboard,
  Clock,
  Copy,
  CreditCard,
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  FolderInput,
  Globe,
  Hash,
  Link as LinkIcon,
  LoaderCircle,
  Lock,
  Menu,
  MessageCircle,
  Mic,
  MoreHorizontal,
  PanelLeft,
  Paperclip,
  Palette,
  Pause,
  PenLine,
  Plus,
  RefreshCw,
  ScanText,
  Search,
  Send,
  Settings as SettingsIcon,
  Shield,
  Sparkles,
  Sprout,
  Square,
  Store,
  Sun,
  LogOut,
  Trash2,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { checkFacts, type FactFinding } from '@/lib/factCheck';
import { compressMedia, compressImage } from '@/lib/imageCompression';
import { storeAttachment, loadAttachmentData, deleteAttachment, clearLocalAttachments, type AttachmentRef } from '@/lib/attachmentStorage';
import { correctTranscript, generateChatResponse, type BehaviorProfile as ChatBehaviorProfile, type AiModelConfig } from '@/lib/chatEngine';
import { WelcomeFlow } from '@/WelcomeFlow';
import type { StorageMode } from '@/lib/supabase';
import { getCurrentSession, onAuthChange, signOut } from '@/lib/supabase';

type NoteItem = {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author?: string;
  mode?: string;
  language?: string;
  attachments?: AttachmentRef[];
  factCheckStatus?: 'idle' | 'checking' | 'done';
  sources?: FactFinding[];
  color?: string;
};
type ChatSource = { title: string; url: string };
type ChatMessage = { id: string; role: 'user' | 'assistant'; text: string; sources?: ChatSource[]; createdAt: string };
type SubChat = { id: string; title: string; notes: NoteItem[]; updatedAt: string; color?: string; messages?: ChatMessage[] };
type Category = { id: string; title: string; emoji: string; color: string; open: boolean; chats: SubChat[] };
type Workspace = { name: string; categories: Category[] };

type SubscriptionTier = 'free' | 'booklet-flat' | 'smart-ki' | 'komplett';
type BillingInterval = 'monthly' | 'yearly';
type Currency = 'CHF' | 'EUR' | 'USD';
type UiLang = 'en' | 'de' | 'de-ch' | 'fr' | 'it' | 'es';
type ProtectionType = 'none' | 'pin' | 'password';
type ThemeMode = 'paper' | 'light' | 'dark';
type AiModel = 'standard' | 'companion' | 'master';
type BehaviorProfile = 'sarcastic' | 'humorous' | 'strict' | 'creative';
type MemoryMode = 'persistent' | 'isolated';
type BodyFont = 'nunito' | 'lora' | 'inter';
type AppSettings = {
  language: string;
  uiLang: UiLang;
  currency: Currency;
  subscriptionTier: SubscriptionTier;
  billingInterval: BillingInterval;
  smartKIMode: boolean;
  trialEndDate: string | null;
  bookletCount: number;
  protection: ProtectionType;
  /** Legacy cleartext secret. Only still read to migrate an existing lock to a hash. */
  protectionValue: string;
  /** Random per-install salt for the app-lock digest. */
  protectionSalt: string;
  /** SHA-256 digest of `salt:secret`. This is what unlock compares against. */
  protectionHash: string;
  onboarded: boolean;
  hasSeenReactivationOffer: boolean;
  theme: ThemeMode;
  fontSize: number;
  aiModel: AiModel;
  companionProfile: BehaviorProfile;
  masterEnabled: boolean;
  memoryMode: MemoryMode;
  biometric: boolean;
  bodyFont: BodyFont;
  storageMode: StorageMode;
  userEmail: string | null;
};

const uiStrings: Record<UiLang, Record<string, string>> = {
  en: { settings: 'Settings', overview: 'Overview', quickChat: 'Quick Chat', areas: 'Areas', newCategory: 'New Category', yourNote: 'YOUR NOTES', newNote: 'Create New Note', back: 'Back to Overview', save: 'Save Note', secure: 'Security & Privacy', handwriting: 'Scan Handwriting', greetingMorning: 'Good morning', greetingDay: 'Good afternoon', greetingEvening: 'Good evening', welcome: 'What shall we talk about today?', areasLabel: 'AREAS', universeLabel: 'YOUR PERSONAL', welcomeBack: 'WELCOME BACK', welcomeDesc: 'A quiet place for everything that matters to you.', continueBtn: 'Continue writing', memoryCard: 'Universe Memory', memoryDesc: 'Everything stays connected.', newSubtopic: 'Add subtopic', emptyTitle: 'A new space for your thoughts.', emptyDesc: 'Create a subtopic on the left and start your first note.', createSubtopic: 'Create subtopic', noteLimit: 'Note limit reached – upgrade', newNoteBtn: 'Create new note', noNotes: 'No notes in this subtopic yet. Click above to write your first note.', entries: 'entries', entry: 'entry', charCount: 'characters', attachFile: 'Attach photo or file', attachDesc: 'Image, PDF or document · max. 12 MB', factCheck: 'Fact Check', copy: 'Copy', booklet: 'Booklet Workshop', saveBtn: 'Save Note', saving: 'Saving…', saved: 'Saved locally', offline: 'Saved offline', failed: 'Save failed', autoSaved: 'Changes are saved automatically', retry: 'Retry', footer: 'A quiet place for everything that matters to you.', speak: 'Speak', pause: 'Pause', resume: 'Resume', stop: 'Stop', deleteTitle: 'Really delete?', deleteNote: 'This note will be permanently deleted. This cannot be undone.', deleteChat: 'This subtopic including all notes will be deleted.', deleteCategory: 'This category including all subtopics and notes will be deleted.', cancel: 'Cancel', deleteForever: 'Delete permanently', rename: 'Rename', moveAction: 'Move…', copyAction: 'Copy', duplicate: 'Duplicate', deleteAction: 'Delete', chatTitle: 'Quick Chat', chatEmpty: 'Ask me anything – what is on your mind?', chatPlaceholder: 'Write or speak your question…', thinking: 'Thinking…', newArea: 'NEW AREA', areaPrompt: 'What would you like to organize?', areaPlaceholder: 'e.g. Garden, Recipes or Family', symbol: 'Symbol', accentColor: 'Accent color', customColor: 'Custom color', createArea: 'Create area', settingsTitle: 'Your Universe', tabKi: 'AI & Memory', tabEditor: 'Editor & Design', tabLang: 'Language & Region', tabSecurity: 'Security & Account', tabAbo: 'Subscription & Store', crashTitle: 'Unsaved changes found', crashDesc: 'Last time, changes were not fully saved. The local version is newer than the cloud version. What would you like to do?', keepCloud: 'Keep cloud version', keepLocal: 'Keep local draft', securityQuestion: 'SECURITY QUESTION', bookletLabel: 'BOOKLET WORKSHOP', bookletTitle: 'Assemble notes', moveLabel: 'MOVE', moveTitle: 'Move where?', attachments: 'attachments', mediaHint: 'Images up to 50 MP · Videos up to 15 sec', factChecking: 'Checking facts…', factsFound: 'findings found – click highlighted spots', factsOk: 'All facts plausible – no action needed', factReview: 'Highlighted text – click a marker to correct:', source: 'Source', open: 'open', adoptToNote: 'Adopt to note', kiResponse: '[AI note]', handwritingTag: '[Handwriting]', noMic: 'Microphone not available', uploadFailed: 'Upload failed', fileTooLarge: 'File too large or format not allowed', noFile: 'No file selected', added: 'added', rejected: 'rejected', attachmentSingular: 'attachment', attachmentPlural: 'attachments', removed: 'Attachments removed', backupExport: 'Export backup', factoryReset: 'Factory reset', backupHint: 'Backup: all notes encrypted as a file. Factory reset: complete secure reset.', universeName: 'Universe name', currentProtection: 'Current protection', noProtection: 'None', pinCode: 'PIN code', password: 'Password', changeProtection: 'Change protection', protectionHint: 'The protection activates when you next open the app.', biometricSoon: 'Face ID / Fingerprint – coming soon', biometricHint: 'Biometric unlock is in development and not yet active.', accountLogin: 'Account & Logins', signedInAs: 'Signed in as', notSignedIn: 'Not signed in – everything stays on this device', googleSoon: 'Google – coming soon', appleSoon: 'Apple ID – coming soon', noAccountHint: 'Without an account, your notes are not synced to the cloud.', signOut: 'Sign out', signOutHint: 'Signing out removes notes from this device. They remain saved in your account.', dataPrivacy: 'Data privacy & local backups', mediaMgmt: 'Media & storage management', mediaElements: 'media elements', stored: 'stored', autoSave: 'Autosave', autoSaveHint: 'Debounce save every 800ms', active: 'Active', themePaper: 'Paper', themeLight: 'Light', themeDark: 'Dark', themeHint: 'Paper mode (default): warm cream tone. Dark mode for night shifts.', fontBody: 'Body font', fontHint: 'Main titles always keep the elegant Cormorant style as a fixed trademark.', fontSize: 'Editor font size', fontPreview: 'This is how your text looks in the editor. Adjust the slider for readability.', editorLang: 'Editor language', editorLangHint: 'Determines language and text context for dictation and AI responses.', currency: 'Currency', categoryMgmt: 'Category management', categoryMgmtHint: 'categories active. Create, rename or delete areas via the + in the main menu.', kiArt: 'AI type & memory', kiArtHint: 'Choose how your digital world thinks, talks and writes with you.', modelSelect: 'Model selection', modelStandard: 'The reliable one', modelStandardDesc: 'Standard model: reliable, calm, strong memory. Summarizes, delivers facts, does exactly what you say.', modelCompanion: 'The sparring partner', modelCompanionDesc: 'Manually configurable: you decide which role the AI plays today – sarcastic, humorous, strict or creative.', modelMaster: 'The automatic style mirror', modelMasterDesc: 'Top tier: learns from your real texts, mirrors your writing style, word choice and humor – fully automatic.', memorySwitch: 'Memory switch', memoryOn: 'Strong cross-topic memory active', memoryOnHint: 'On: the AI keeps the thread across all notebooks. Off: full privacy, no cross-device or cross-history memory.', behaviorProfile: 'Behavior profile – manual', behaviorProfileHint: 'You set the profile. The AI adapts exactly to this character until you change it.', profileSarcastic: 'Sarcastic & direct', profileSarcasticDesc: 'Honest, unvarnished opinion. No mincing words.', profileHumorous: 'Dry humor', profileHumorousDesc: 'Casual, with a wink, but still helpful.', profileStrict: 'Strict & fact-checking', profileStrictDesc: 'Critical, precise, absolute fact-checking.', profileCreative: 'Playful & creative', profileCreativeDesc: 'Brainstorming partner, idea-rich, associative.', masterControl: 'Master mirror control', masterActive: 'Automatic style & behavior mirror active', masterActiveHint: 'Active: the AI learns from your notes and mirrors your style. Inactive: falls back to neutral mode immediately.', styleAnalysis: 'Style analysis of your notes:', activeSamples: 'Active writing samples:', memoryPersistent: 'persistent cross-topic', memoryIsolated: 'isolated per chat', memoryModule: 'Memory module (general)', memPersistentTitle: 'Persistent universe memory', memPersistentDesc: 'The AI remembers information, preferences and contexts across topics as long-term memory.', memIsolatedTitle: 'Strict chat isolation', memIsolatedDesc: 'No permanent background memory. Each chat stays absolutely isolated. Absolute privacy.', aboTitle: 'Subscription, Store & Support', tierStatus: 'Current tier status', toStore: 'To store', billingInterval: 'Billing interval', monthly: 'Monthly', yearly: 'Yearly', saveBadge: 'save', trialActive: '30-day free trial active', trialEnds: 'Ends', layout: 'Layout', tonality: 'Tonality', calligraphic: 'Calligraphic initials', on: 'On', off: 'Off', bookletCopied: 'Booklet copied', bookletPreviewHint: 'Trial mode: unlimited booklets available – no lock.', notebook: 'Notebook', classic: 'Classic', modern: 'Modern', diary: 'Diary', personal: 'Personal', factual: 'Factual', poetic: 'Poetic', personalDesc: 'As told at the kitchen table.', poeticDesc: 'A still image of words.', noContent: '—', welcomeModalTitle: 'Your personal universe', welcomeModalDesc: 'A clear place for notes, projects and the little things in between.' },
  de: { settings: 'Einstellungen', overview: 'Übersicht', quickChat: 'Quick-Chat', areas: 'Bereiche', newCategory: 'Neue Kategorie', yourNote: 'DEINE NOTIZEN', newNote: 'Neue Notiz erstellen', back: 'Zurück zur Übersicht', save: 'Notiz sichern', secure: 'Sicherheit & Privatsphäre', handwriting: 'Handschrift einscannen', greetingMorning: 'Guten Morgen', greetingDay: 'Guten Tag', greetingEvening: 'Guten Abend', welcome: 'Worüber reden wir heute?', areasLabel: 'BEREICHE', universeLabel: 'DEIN PERSÖNLICHES', welcomeBack: 'WILLKOMMEN ZURÜCK', welcomeDesc: 'Ein klarer Ort für Notizen, Projekte und die kleinen Dinge dazwischen.', continueBtn: 'Weiter schreiben', memoryCard: 'Universum-Gedächtnis', memoryDesc: 'Alles bleibt verbunden.', newSubtopic: 'Unterthema hinzufügen', emptyTitle: 'Ein neuer Raum für deine Gedanken.', emptyDesc: 'Lege links ein Unterthema an und starte deine erste Notiz.', createSubtopic: 'Unterthema erstellen', noteLimit: 'Notiz-Limit erreicht – Abo erweitern', newNoteBtn: 'Neue Notiz erstellen', noNotes: 'Noch keine Notizen in diesem Unterthema. Klicke oben, um deine erste Notiz zu schreiben.', entries: 'Einträge', entry: 'Eintrag', charCount: 'Zeichen', attachFile: 'Foto oder Datei anhängen', attachDesc: 'Bild, PDF oder Dokument · max. 12 MB', factCheck: 'Fakten prüfen', copy: 'Kopieren', booklet: 'Büchlein-Werkstatt', saveBtn: 'Notiz sichern', saving: 'Wird gespeichert …', saved: 'Änderungen lokal gesichert', offline: 'Offline gespeichert', failed: 'Speichern fehlgeschlagen', autoSaved: 'Änderungen werden automatisch gemerkt', retry: 'Erneut versuchen', footer: 'Ein ruhiger Ort für alles, was dir wichtig ist.', speak: 'Sprechen', pause: 'Pause', resume: 'Fortsetzen', stop: 'Stop', deleteTitle: 'Wirklich löschen?', deleteNote: 'Diese Notiz wird endgültig gelöscht. Dies kann nicht rückgängig gemacht werden.', deleteChat: 'Dieses Unterthema inkl. aller Notizen wird gelöscht.', deleteCategory: 'Diese Kategorie inkl. aller Unterthemen und Notizen wird gelöscht.', cancel: 'Abbrechen', deleteForever: 'Endgültig löschen', rename: 'Umbenennen', moveAction: 'Verschieben …', copyAction: 'Kopieren', duplicate: 'Duplizieren', deleteAction: 'Löschen', chatTitle: 'Quick-Chat', chatEmpty: 'Frag mich einfach – was beschäftigt dich?', chatPlaceholder: 'Frage schreiben oder sprechen …', thinking: 'Ich denke nach …', newArea: 'NEUER BEREICH', areaPrompt: 'Was möchtest du ordnen?', areaPlaceholder: 'z. B. Garten, Rezepte oder Familie', symbol: 'Symbol', accentColor: 'Akzentfarbe', customColor: 'Freie Farbe', createArea: 'Bereich anlegen', settingsTitle: 'Dein Universum', tabKi: 'KI & Gedächtnis', tabEditor: 'Editor & Optik', tabLang: 'Sprache & Region', tabSecurity: 'Sicherheit & Account', tabAbo: 'Abo & Store', crashTitle: 'Ungesicherte Änderungen gefunden', crashDesc: 'Beim letzten Mal wurden Änderungen nicht vollständig gespeichert. Die lokale Version ist aktueller als die Cloud-Version. Was möchtest du tun?', keepCloud: 'Cloud-Version behalten', keepLocal: 'Lokalen Entwurf behalten', securityQuestion: 'SICHERHEITSABFRAGE', bookletLabel: 'BÜCHLEIN-WERKSTATT', bookletTitle: 'Notizen zusammenfügen', moveLabel: 'VERSCHIEBEN', moveTitle: 'Wohin verschieben?', attachments: 'Anhänge', mediaHint: 'Bilder bis 50 MP · Videos bis 15 Sek', factChecking: 'Fachdatenbank-Abgleich aktiv …', factsFound: 'Hinweise gefunden – klicke auf die markierten Stellen', factsOk: 'Alle Fakten plausibel – kein Handlungsbedarf', factReview: 'Markierte Stellen im Text – klicke auf eine Markierung zum Korrigieren:', source: 'Quelle', open: 'öffnen', adoptToNote: 'In Notiz übernehmen', kiResponse: '[KI-Notiz]', handwritingTag: '[Handschrift]', noMic: 'Mikrofon nicht verfügbar', uploadFailed: 'Upload fehlgeschlagen', fileTooLarge: 'Datei zu gross oder Format nicht erlaubt', noFile: 'Keine Datei ausgewählt', added: 'hinzugefügt', rejected: 'abgelehnt', attachmentSingular: 'Anhang', attachmentPlural: 'Anhänge', removed: 'Anhänge entfernt', backupExport: 'Backup exportieren', factoryReset: 'Werkseinstellung', backupHint: 'Backup: alle Notizen verschlüsselt als Datei. Werkseinstellung: kompletter sicherer Reset.', universeName: 'Universum-Name', currentProtection: 'Aktueller Schutz', noProtection: 'Keiner', pinCode: 'PIN-Code', password: 'Passwort', changeProtection: 'Schutz ändern', protectionHint: 'Der Schutz wird beim nächsten Öffnen der App aktiv.', biometricSoon: 'Face ID / Fingerabdruck – bald verfügbar', biometricHint: 'Biometrische Entsperung ist in Entwicklung und noch nicht aktiv.', accountLogin: 'Account & Anmeldungen', signedInAs: 'Angemeldet als', notSignedIn: 'Nicht angemeldet – alles bleibt auf diesem Gerät', googleSoon: 'Google – bald verfügbar', appleSoon: 'Apple-ID – bald verfügbar', noAccountHint: 'Ohne Konto werden deine Notizen nicht in die Cloud übertragen.', signOut: 'Abmelden', signOutHint: 'Beim Abmelden werden die Notizen von diesem Gerät entfernt. In deinem Konto bleiben sie gespeichert.', dataPrivacy: 'Datenschutz & Lokale Backups', mediaMgmt: 'Medien- & Speicher-Management', mediaElements: 'Medienelemente', stored: 'gespeichert', autoSave: 'Automatisches Speichern', autoSaveHint: 'Debounce-Speicherung alle 800ms', active: 'Aktiv', themePaper: 'Papier', themeLight: 'Hell', themeDark: 'Dunkel', themeHint: 'Papier-Modus (Standard): warmer Cremeton. Dunkelmodus für Nachtschichten.', fontBody: 'Schriftart', fontHint: 'Haupttitel behalten immer den edlen Cormorant-Schriftstil als festes Markenzeichen.', fontSize: 'Schriftgröße im Editor', fontPreview: 'So sieht dein Text im Editor aus. Mit dem Regler kannst du die Lesbarkeit anpassen.', editorLang: 'Editor-Sprache', editorLangHint: 'Bestimmt den Sprach- und Textkontext für Diktate und KI-Antworten.', currency: 'Landeswährung', categoryMgmt: 'Kategorien-Verwaltung', categoryMgmtHint: 'Kategorien aktiv. Erstelle, umbenenne oder lösche Bereiche über das + im Hauptmenü.', kiArt: 'KI-Art & Gedächtnis', kiArtHint: 'Die Wahl, wie deine digitale Welt mit dir denkt, redet und schreibt.', modelSelect: 'Modell-Auswahl', modelStandard: 'Der solide Verlässliche', modelStandardDesc: 'Standard-Modell: zuverlässig, unaufgeregt, starkes Gedächtnis. Fasst zusammen, liefert Fakten, macht exakt was du sagst.', modelCompanion: 'Der Sparringspartner nach Wunsch', modelCompanionDesc: 'Manuell konfigurierbar: du bestimmst, in welcher Rolle die KI heute agiert – sarkastisch, humorvoll, streng oder kreativ.', modelMaster: 'Der automatische Stil-Spiegel', modelMasterDesc: 'Königsstufe: lernt aus deinen echten Texten, übernimmt deinen Schreibstil, deine Wortwahl und deinen Humor – völlig automatisch.', memorySwitch: 'Gedächtnis-Schalter', memoryOn: 'Starkes übergreifendes Gedächtnis aktiv', memoryOnHint: 'An: die KI behält den roten Faden über alle Notizbücher hinweg. Aus: volle Privatsphäre, kein geräte- oder verlaufsübergreifendes Gedächtnis.', behaviorProfile: 'Verhaltens-Profil manuell einstellen', behaviorProfileHint: 'Du bestimmst das Profil. Die KI passt sich exakt diesem Charakter an, bis du ihn änderst.', profileSarcastic: 'Sarkastisch & direkt', profileSarcasticDesc: 'Ehrliche, ungeschminkte Meinung. Kein Blatt vor den Mund.', profileHumorous: 'Trocken-humorvoll', profileHumorousDesc: 'Locker, mit Augenzwinkern, aber dennoch hilfreich.', profileStrict: 'Streng & fehlerprüfend', profileStrictDesc: 'Kritisch, präzise, absolutes Fakten-Checking.', profileCreative: 'Spielerisch-kreativ', profileCreativeDesc: 'Brainstorming-Partner, ideenreich, assoziativ.', masterControl: 'Master-Spiegel-Steuerung', masterActive: 'Automatischer Stil- & Verhaltens-Spiegel aktiv', masterActiveHint: 'Aktiv: die KI lernt aus deinen Notizen und spiegelt deinen Stil. Inaktiv: fällt sofort in den neutralen Modus zurück.', styleAnalysis: 'Stil-Analyse deiner Notizen:', activeSamples: 'Aktive Schreibproben:', memoryPersistent: 'persistent übergreifend', memoryIsolated: 'isoliert pro Chat', memoryModule: 'Gedächtnis-Modul (allgemein)', memPersistentTitle: 'Persistentes Universum-Gedächtnis', memPersistentDesc: 'Die KI merkt sich übergreifend Informationen, Vorlieben und Kontexte als langfristiges Gedächtnis.', memIsolatedTitle: 'Strikte Chat-Isolation', memIsolatedDesc: 'Kein dauerhaftes Hintergrundgedächtnis. Jeder Chat bleibt absolut isoliert. Absolute Privatsphäre.', aboTitle: 'Abo, Store & Support', tierStatus: 'Aktueller Tarif-Status', toStore: 'Zum Store', billingInterval: 'Abrechnungs-Intervall', monthly: 'Monatlich', yearly: 'Jährlich', saveBadge: 'sparen', trialActive: '30-Tage Gratismonat aktiv', trialEnds: 'Endet', layout: 'Layout', tonality: 'Tonalität', calligraphic: 'Kalligrafische Initialen', on: 'Ein', off: 'Aus', bookletCopied: 'Büchlein kopiert', bookletPreviewHint: 'Testbetrieb: Unbegrenzte Büchlein verfügbar – keine Sperre.', notebook: 'Notizbuch', classic: 'Klassisch', modern: 'Modern', diary: 'Tagebuch', personal: 'Persönlich', factual: 'Sachlich', poetic: 'Poetisch', personalDesc: 'Wie erzählt am Küchentisch.', poeticDesc: 'Ein stilles Bild aus Worten.', noContent: '—', welcomeModalTitle: 'Dein persönliches Universum', welcomeModalDesc: 'Ein klarer Ort für Notizen, Projekte und die kleinen Dinge dazwischen.' },
  'de-ch': { settings: 'Iistellige', overview: 'Übersicht', quickChat: 'Schnell-Chat', areas: 'Beriich', newCategory: 'Neui Kategorie', yourNote: 'DINI NOTIZE', newNote: 'Neui Notiz erstelle', back: 'Zrugg zur Übersicht', save: 'Notiz sichere', secure: 'Sicherheit & Privatsphäre', handwriting: 'Handschrift iiscanne', greetingMorning: 'Guete Morge', greetingDay: 'Guete Tag', greetingEvening: 'Guete Obe', welcome: 'Worüber reded mer hüt?', areasLabel: 'BERIICH', universeLabel: 'DIS PERSÖNLICHS', welcomeBack: 'WILLKOMME ZRUG', welcomeDesc: 'E klare Ort für Notize, Projekt und die chliine Sache zwüschedrin.', continueBtn: 'Wiiter schribe', memoryCard: 'Universum-Gedächtnis', memoryDesc: 'Alles blibt verbunde.', newSubtopic: 'Underthema zuefüege', emptyTitle: 'E nöie Raum für dini Gedanke.', emptyDesc: 'Lege links e Underthema a und start dini ersti Notiz.', createSubtopic: 'Underthema erstelle', noteLimit: 'Notiz-Limit erreicht – Abo erwiitere', newNoteBtn: 'Neui Notiz erstelle', noNotes: 'No kei Notize i dem Underthema. Klicke obe, um dini ersti Notiz z schribe.', entries: 'Iiträg', entry: 'Iitrag', charCount: 'Zeiche', attachFile: 'Foto oder Datei aahänke', attachDesc: 'Bild, PDF oder Dokumänt · max. 12 MB', factCheck: 'Fakten prüefe', copy: 'Kopiere', booklet: 'Büechli-Wärchstett', saveBtn: 'Notiz sichere', saving: 'Wird gspeicheret …', saved: 'Änderige lokal gsicheret', offline: 'Offline gspeicheret', failed: 'Speichere fehlgschlage', autoSaved: 'Änderige wärde automatisch gmërkt', retry: 'Nochmal versueche', footer: 'E ruige Ort für alles, was dir wichtig isch.' },
  fr: { settings: 'Paramètres', overview: 'Aperçu', quickChat: 'Chat rapide', areas: 'Domaines', newCategory: 'Nouvelle catégorie', yourNote: 'VOS NOTES', newNote: 'Créer une note', back: 'Retour à la liste', save: 'Enregistrer', secure: 'Sécurité & Confidentialité', handwriting: 'Scanner l’écriture', greetingMorning: 'Bonjour', greetingDay: 'Bon après-midi', greetingEvening: 'Bonsoir', welcome: 'De quoi parlons-nous aujourd’hui?', areasLabel: 'DOMAINES', universeLabel: 'VOTRE PERSONNEL', welcomeBack: 'BIENVENUE', welcomeDesc: 'Un lieu clair pour vos notes, projets et les petites choses entre deux.', continueBtn: 'Continuer à écrire', memoryCard: 'Mémoire de l’Univers', memoryDesc: 'Tout reste connecté.', newSubtopic: 'Ajouter un sous-thème', emptyTitle: 'Un nouvel espace pour vos pensées.', emptyDesc: 'Créez un sous-thème à gauche et commencez votre première note.', createSubtopic: 'Créer un sous-thème', noteLimit: 'Limite de notes atteinte – mettre à niveau', newNoteBtn: 'Créer une nouvelle note', noNotes: 'Aucune note dans ce sous-thème. Cliquez ci-dessus pour écrire votre première note.', entries: 'entrées', entry: 'entrée', charCount: 'caractères', attachFile: 'Joindre une photo ou un fichier', attachDesc: 'Image, PDF ou document · max. 12 Mo', factCheck: 'Vérifier les faits', copy: 'Copier', booklet: 'Atelier de livrets', saveBtn: 'Enregistrer la note', saving: 'Enregistrement…', saved: 'Enregistré localement', offline: 'Enregistré hors ligne', failed: 'Échec de l’enregistrement', autoSaved: 'Les modifications sont enregistrées automatiquement', retry: 'Réessayer', footer: 'Un lieu calme pour tout ce qui compte pour vous.' },
  it: { settings: 'Impostazioni', overview: 'Panoramica', quickChat: 'Chat rapida', areas: 'Aree', newCategory: 'Nuova categoria', yourNote: 'LE TUE NOTE', newNote: 'Crea nota', back: 'Torna alla lista', save: 'Salva nota', secure: 'Sicurezza & Privacy', handwriting: 'Scansiona scrittura', greetingMorning: 'Buongiorno', greetingDay: 'Buon pomeriggio', greetingEvening: 'Buonasera', welcome: 'Di cosa parliamo oggi?', areasLabel: 'AREE', universeLabel: 'IL TUO PERSONALE', welcomeBack: 'BENTORNATO', welcomeDesc: 'Un luogo chiaro per note, progetti e le piccole cose in mezzo.', continueBtn: 'Continua a scrivere', memoryCard: 'Memoria dell’Universo', memoryDesc: 'Tutto resta collegato.', newSubtopic: 'Aggiungi sotto-tema', emptyTitle: 'Un nuovo spazio per i tuoi pensieri.', emptyDesc: 'Crea un sotto-tema a sinistra e inizia la tua prima nota.', createSubtopic: 'Crea sotto-tema', noteLimit: 'Limite di note raggiunto – aggiorna', newNoteBtn: 'Crea nuova nota', noNotes: 'Nessuna nota in questo sotto-tema. Clicca sopra per scrivere la tua prima nota.', entries: 'voci', entry: 'voce', charCount: 'caratteri', attachFile: 'Allega foto o file', attachDesc: 'Immagine, PDF o documento · max. 12 MB', factCheck: 'Verifica fatti', copy: 'Copia', booklet: 'Laboratorio di opuscoli', saveBtn: 'Salva nota', saving: 'Salvataggio…', saved: 'Salvato localmente', offline: 'Salvato offline', failed: 'Salvataggio fallito', autoSaved: 'Le modifiche vengono salvate automaticamente', retry: 'Riprova', footer: 'Un luogo tranquillo per tutto ciò che conta per te.' },
  es: { settings: 'Ajustes', overview: 'Vista general', quickChat: 'Chat rápido', areas: 'Áreas', newCategory: 'Nueva categoría', yourNote: 'TUS NOTAS', newNote: 'Crear nota', back: 'Volver a la lista', save: 'Guardar nota', secure: 'Seguridad & Privacidad', handwriting: 'Escanear escritura', greetingMorning: 'Buenos días', greetingDay: 'Buenas tardes', greetingEvening: 'Buenas noches', welcome: '¿De qué hablamos hoy?', areasLabel: 'ÁREAS', universeLabel: 'TU PERSONAL', welcomeBack: 'BIENVENIDO', welcomeDesc: 'Un lugar claro para notas, proyectos y las pequeñas cosas entre medias.', continueBtn: 'Seguir escribiendo', memoryCard: 'Memoria del Universo', memoryDesc: 'Todo sigue conectado.', newSubtopic: 'Añadir subtema', emptyTitle: 'Un nuevo espacio para tus pensamientos.', emptyDesc: 'Crea un subtema a la izquierda y empieza tu primera nota.', createSubtopic: 'Crear subtema', noteLimit: 'Límite de notas alcanzado – actualizar', newNoteBtn: 'Crear nueva nota', noNotes: 'Aún no hay notas en este subtema. Haz clic arriba para escribir tu primera nota.', entries: 'entradas', entry: 'entrada', charCount: 'caracteres', attachFile: 'Adjuntar foto o archivo', attachDesc: 'Imagen, PDF o documento · máx. 12 MB', factCheck: 'Verificar hechos', copy: 'Copiar', booklet: 'Taller de libritos', saveBtn: 'Guardar nota', saving: 'Guardando…', saved: 'Guardado localmente', offline: 'Guardado sin conexión', failed: 'Error al guardar', autoSaved: 'Los cambios se guardan automáticamente', retry: 'Reintentar', footer: 'Un lugar tranquilo para todo lo que te importa.' },
};

function t(uiLang: UiLang, key: string): string { return uiStrings[uiLang]?.[key] ?? uiStrings.en[key] ?? uiStrings.de[key] ?? key; }

const greetingMap: Record<UiLang, { morning: string; day: string; evening: string }> = {
  en: { morning: 'Good morning', day: 'Good afternoon', evening: 'Good evening' },
  de: { morning: 'Guten Morgen', day: 'Guten Tag', evening: 'Guten Abend' },
  'de-ch': { morning: 'Guete Morge', day: 'Guete Tag', evening: 'Guete Obe' },
  fr: { morning: 'Bonjour', day: 'Bon après-midi', evening: 'Bonsoir' },
  it: { morning: 'Buongiorno', day: 'Buon pomeriggio', evening: 'Buonasera' },
  es: { morning: 'Buenos días', day: 'Buenas tardes', evening: 'Buenas noches' },
};

function getGreeting(uiLang: UiLang): string {
  const h = new Date().getHours();
  const g = greetingMap[uiLang] ?? greetingMap.en;
  return h < 12 ? g.morning : h < 18 ? g.day : g.evening;
}

const STORAGE_KEY = 'universum-workspace';
const LAST_EDIT_KEY = 'universum-last-edit';
const LAST_SAVE_KEY = 'universum-last-save';
const SETTINGS_KEY = 'universum-settings';

const defaultSettings: AppSettings = {
  language: 'English',
  uiLang: 'en',
  currency: 'CHF',
  subscriptionTier: 'free',
  billingInterval: 'monthly',
  smartKIMode: false,
  trialEndDate: null,
  bookletCount: 0,
  protection: 'none',
  protectionValue: '',
  protectionSalt: '',
  protectionHash: '',
  onboarded: false,
  hasSeenReactivationOffer: false,
  theme: 'paper',
  fontSize: 15,
  aiModel: 'standard',
  companionProfile: 'creative',
  masterEnabled: false,
  memoryMode: 'persistent',
  biometric: false,
  bodyFont: 'nunito',
  storageMode: 'local',
  userEmail: null,
};

function loadSettings(): AppSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    return saved ? { ...defaultSettings, ...JSON.parse(saved) as Partial<AppSettings> } : defaultSettings;
  } catch { return defaultSettings; }
}

const tierInfo: Record<SubscriptionTier, { name: string; price: Record<BillingInterval, number>; desc: string; features: string[] }> = {
  free: { name: 'Basis', price: { monthly: 0, yearly: 0 }, desc: 'Standard-KI & 2 Notizbücher', features: ['Standard-KI-Assistent', '2 kostenlose Notizbücher', '30-Tage Gratismonat für alle Premium-Funktionen'] },
  'booklet-flat': { name: 'Büchlein-Flat', price: { monthly: 4.9, yearly: 49 }, desc: 'Unbegrenzte Notizbücher', features: ['Unbegrenzte Notizbücher', 'Büchlein-Werkstatt', 'Alle Layouts & Initialen'] },
  'smart-ki': { name: 'Smart-KI', price: { monthly: 9.9, yearly: 99 }, desc: 'Mitlernende KI', features: ['Persönlicher Schreibstil', 'Humor & Kontext-Anpassung', 'Gedächtnis-Modus'] },
  komplett: { name: 'Komplett-Universum', price: { monthly: 12.9, yearly: 129 }, desc: 'Das Kombi-Paket', features: ['Alles aus Büchlein-Flat', 'Alles aus Smart-KI', 'Priorisierte Antworten', 'Bestes Preis-Leistungs-Verhältnis'] },
};

/* ---------- Attachment validation ----------
   The file picker's `accept` attribute is only a hint the browser may ignore,
   so every file is re-checked here before it is inlined into the workspace. */
const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = [
  'image/', 'video/',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

function isAllowedAttachment(file: File): boolean {
  if (file.size <= 0 || file.size > MAX_ATTACHMENT_BYTES) return false;
  const type = (file.type || '').toLowerCase();
  if (!type) return false;
  return ALLOWED_ATTACHMENT_TYPES.some((t) => (t.endsWith('/') ? type.startsWith(t) : type === t));
}

/* ---------- App-lock secret hashing ----------
   The PIN / password that guards the app is never persisted in clear text.
   We keep a random salt plus a SHA-256 digest, and compare digests on unlock. */
function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toHex(bytes.buffer);
}

async function hashSecret(value: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${value}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(digest);
}

export async function makeProtectionHash(value: string): Promise<{ salt: string; hash: string }> {
  const salt = randomSalt();
  return { salt, hash: await hashSecret(value, salt) };
}

function makeNote(content = '', language = 'English'): NoteItem {
  const now = new Date().toISOString();
  return { id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, content, createdAt: now, updatedAt: now, language, factCheckStatus: 'idle', sources: [] };
}

const defaultWorkspace: Workspace = {
  name: '',
  categories: [],
};

function migrateWorkspace(w: Workspace): Workspace {
  return { ...w, categories: w.categories.map((c) => ({ ...c, chats: c.chats.map((ch: Record<string, unknown>) => {
    if (Array.isArray(ch.notes)) return ch as unknown as SubChat;
    const oldNote = typeof ch.note === 'string' ? ch.note : '';
    const notes: NoteItem[] = oldNote.trim() ? [{ id: `note-migrated-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, content: oldNote, createdAt: (ch.updatedAt as string) || new Date().toISOString(), updatedAt: (ch.updatedAt as string) || new Date().toISOString(), factCheckStatus: 'idle', sources: [] }] : [];
    const { note: _note, ...rest } = ch;
    void _note;
    return { ...rest, notes, messages: (ch.messages as ChatMessage[]) || undefined, attachments: undefined } as unknown as SubChat;
  }) })) };
}

function loadWorkspace(): Workspace {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? migrateWorkspace(JSON.parse(saved) as Workspace) : defaultWorkspace;
  } catch { return defaultWorkspace; }
}

function App() {
  const [workspace, setWorkspace] = useState<Workspace>(loadWorkspace);
  const [activeCategoryId, setActiveCategoryId] = useState('');
  const [activeChatId, setActiveChatId] = useState('');
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [subChatDraft, setSubChatDraft] = useState('');
  const [language, setLanguage] = useState('English');
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatThinking, setChatThinking] = useState(false);
  const [chatRecording, setChatRecording] = useState(false);
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [newCategory, setNewCategory] = useState({ title: '', emoji: '🌿', color: '#6f9270' });
  const [emojiPicker, setEmojiPicker] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [manageMenu, setManageMenu] = useState<{ type: 'category' | 'chat' | 'note'; categoryId: string; chatId?: string; noteId?: string; x: number; y: number } | null>(null);
  const [moveDialog, setMoveDialog] = useState<{ chatId: string; fromCategoryId: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'note' | 'chat' | 'category'; id: string; categoryId?: string; chatId?: string } | null>(null);
  const [bookletDialog, setBookletDialog] = useState(false);
  const [bookletOptions, setBookletOptions] = useState({ layout: 'Klassisch', initialen: true, tonalitaet: 'Persönlich' });
  const [crashDialog, setCrashDialog] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'offline' | 'failed'>('idle');
  const [actionNotice, setActionNotice] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'ki' | 'editor' | 'sprache' | 'sicherheit' | 'abo'>('ki');
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [recordingPaused, setRecordingPaused] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ type: 'category' | 'chat'; categoryId: string; chatId?: string; currentName: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [ocrDialog, setOcrDialog] = useState(false);
  const [ocrImage, setOcrImage] = useState<string | null>(null);
  const [ocrSegments, setOcrSegments] = useState<{ id: string; text: string; selected: boolean }[]>([]);
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [onboarding, setOnboarding] = useState(!settings.onboarded);
  const [locked, setLocked] = useState(settings.protection !== 'none' && settings.onboarded);
  const [lockInput, setLockInput] = useState('');
  const [lockError, setLockError] = useState(false);
  const [bookletUpgrade, setBookletUpgrade] = useState(false);
  const [trialOffer, setTrialOffer] = useState(false);
  const [purchaseDialog, setPurchaseDialog] = useState<{ tier: SubscriptionTier; interval: BillingInterval } | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showLockPassword, setShowLockPassword] = useState(false);
  const [emojiSearch, setEmojiSearch] = useState('');
  const [customColor, setCustomColor] = useState('#6f9270');
  const [showCustomColor, setShowCustomColor] = useState(false);
  const [cacheStats, setCacheStats] = useState<{ items: number; sizeKb: number }>({ items: 0, sizeKb: 0 });
  const [showFeedback, setShowFeedback] = useState(false);
  const [factModal, setFactModal] = useState<FactFinding | null>(null);
  const [factModalIndex, setFactModalIndex] = useState(0);
  const [dismissedFacts, setDismissedFacts] = useState<Set<string>>(new Set());
  const [manualEditValue, setManualEditValue] = useState('');
  const [showManualEdit, setShowManualEdit] = useState(false);
  const [clearCacheConfirm, setClearCacheConfirm] = useState(false);
  const [loadedAtt, setLoadedAtt] = useState<Record<string, string>>({});
  const [protectionDialog, setProtectionDialog] = useState<{ mode: 'setup' | 'change'; type: ProtectionType; value: string } | null>(null);
  const ocrFileRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const chatRecognitionRef = useRef<SpeechRecognition | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<number | null>(null);
  const isDirtyRef = useRef(false);
  const pausedRef = useRef(false);
  const cloudStateRef = useRef<Workspace | null>(null);
  const workspaceRef = useRef(workspace);

  const activeCategory = workspace.categories.find((c) => c.id === activeCategoryId) ?? workspace.categories[0];
  const activeChat = activeCategory?.chats.find((ch) => ch.id === activeChatId) ?? activeCategory?.chats[0];
  const sortedNotes = useMemo(() => activeChat ? [...activeChat.notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [], [activeChat]);
  const activeNote = activeChat?.notes.find((n) => n.id === activeNoteId) ?? null;
  const noteContent = activeNote?.content ?? '';
  const noteAttachments = activeNote?.attachments ?? [];
  const attMode: 'cloud' | 'local' = settings.storageMode === 'cloud' && settings.userEmail ? 'cloud' : 'local';
  useEffect(() => {
    if (!activeNote) return;
    const refs = (activeNote.attachments ?? []).filter((a) => !a.dataUrl && a.storageKey && !loadedAtt[a.id]);
    if (refs.length === 0) return;
    let cancelled = false;
    void Promise.all(refs.map(async (r) => {
      try { const url = await loadAttachmentData(r, attMode); return [r.id, url] as const; }
      catch { return null; }
    })).then((results) => {
      if (cancelled) return;
      setLoadedAtt((prev) => { const next = { ...prev }; for (const r of results) if (r) next[r[0]] = r[1]; return next; });
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNote?.id]);
  const chatMessages = activeChat?.messages ?? [];
  const factCheckStatus = activeNote?.factCheckStatus ?? 'idle';
  const facts = activeNote?.sources ?? [];
  const greeting = getGreeting(settings.uiLang);

  const totalNoteCount = useMemo(() => workspace.categories.reduce((sum, c) => sum + c.chats.reduce((cs, ch) => cs + ch.notes.length, 0), 0), [workspace.categories]);
  const trialEndDate = settings.trialEndDate ? new Date(settings.trialEndDate) : null;
  const trialActive = trialEndDate ? trialEndDate.getTime() > Date.now() : false;
  const effectiveTier: SubscriptionTier = trialActive ? 'komplett' : settings.subscriptionTier;
  const noteLimit = effectiveTier === 'free' ? 2 : Infinity;
  const noteLimitReached = false;
  const isPremium = effectiveTier !== 'free';
  const displayInitial = workspace.name.trim().charAt(0).toUpperCase() || '✦';

  useEffect(() => { workspaceRef.current = workspace; }, [workspace]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
    localStorage.setItem(LAST_EDIT_KEY, Date.now().toString());
    isDirtyRef.current = true;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    setSaveStatus('saving');
    saveTimerRef.current = window.setTimeout(async () => {
      // Local mode is local only: nothing leaves the device.
      if (settings.storageMode !== 'cloud') { setSaveStatus('offline'); isDirtyRef.current = false; return; }
      if (!supabase) { setSaveStatus('offline'); isDirtyRef.current = false; return; }
      const { error } = await supabase.from('user_universe_state').upsert({ state: workspaceRef.current, updated_at: new Date().toISOString() });
      if (error) { setSaveStatus('failed'); } else { setSaveStatus('saved'); isDirtyRef.current = false; localStorage.setItem(LAST_SAVE_KEY, Date.now().toString()); }
    }, 800);
    return () => { if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current); };
  }, [workspace]);

  useEffect(() => {
    let cancelled = false;
    async function restoreCloudState() {
      if (!supabase) return;
      // Only an account-backed workspace is restored from the cloud.
      // Local mode never reads or writes remote state.
      if (settings.storageMode !== 'cloud') return;
      const { data } = await supabase.from('user_universe_state').select('state, updated_at').maybeSingle();
      if (!cancelled && data?.state && typeof data.state === 'object') {
        const cloudState = migrateWorkspace(data.state as Workspace);
        const lastEdit = parseInt(localStorage.getItem(LAST_EDIT_KEY) ?? '0');
        const lastSave = parseInt(localStorage.getItem(LAST_SAVE_KEY) ?? '0');
        if (lastEdit > lastSave && lastSave > 0) {
          cloudStateRef.current = cloudState;
        } else {
          setWorkspace(cloudState);
          localStorage.setItem(LAST_SAVE_KEY, Date.now().toString());
        }
      }
    }
    void restoreCloudState();
    const lastEdit = parseInt(localStorage.getItem(LAST_EDIT_KEY) ?? '0');
    const lastSave = parseInt(localStorage.getItem(LAST_SAVE_KEY) ?? '0');
    if (supabase && lastEdit > lastSave && lastSave > 0) setCrashDialog(true);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const handler = () => { localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaceRef.current)); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  useEffect(() => { if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight; }, [chatMessages, chatThinking]);

  useEffect(() => { const t = window.setTimeout(() => setActionNotice(''), 2000); return () => window.clearTimeout(t); }, [actionNotice]);

  useEffect(() => { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }, [settings]);

  useEffect(() => { if (settings.language !== language) setLanguage(settings.language); }, [settings.language]);

  useEffect(() => {
    if (settings.trialEndDate && new Date(settings.trialEndDate) < new Date()) {
      setSettings((s) => {
        if (!s.trialEndDate || new Date(s.trialEndDate) >= new Date()) return s;
        const next = { ...s, trialEndDate: null, subscriptionTier: 'free' as SubscriptionTier };
        if (!s.hasSeenReactivationOffer) setTrialOffer(true);
        return next;
      });
    }
  }, [settings.trialEndDate]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  useEffect(() => {
    const root = document.documentElement;
    const fontMap: Record<BodyFont, string> = { nunito: "'Nunito', sans-serif", lora: "'Lora', serif", inter: "'Inter', sans-serif" };
    root.style.setProperty('--body-font', fontMap[settings.bodyFont]);
  }, [settings.bodyFont]);

  useEffect(() => {
    void getCurrentSession().then((session) => {
      if (session?.user?.email) {
        setSettings((s) => ({ ...s, userEmail: session.user.email ?? null, storageMode: 'cloud' }));
      }
    });
    const unsub = onAuthChange((session) => {
      if (session?.user?.email) {
        setSettings((s) => ({ ...s, userEmail: session.user.email ?? null, storageMode: 'cloud' }));
      } else if (!session) {
        setSettings((s) => (s.storageMode === 'cloud' ? { ...s, userEmail: null, storageMode: 'local' } : s));
      }
    });
    return unsub;
  }, []);

  const saveToCloud = useCallback(async () => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    // Local mode is local only: nothing leaves the device.
    if (settings.storageMode !== 'cloud') { setSaveStatus('offline'); isDirtyRef.current = false; return; }
    if (!supabase) { setSaveStatus('offline'); isDirtyRef.current = false; return; }
    setSaveStatus('saving');
    try {
      const { error } = await supabase.from('user_universe_state').upsert({ state: workspaceRef.current, updated_at: new Date().toISOString() });
      if (error) { setSaveStatus('failed'); } else { setSaveStatus('saved'); isDirtyRef.current = false; localStorage.setItem(LAST_SAVE_KEY, Date.now().toString()); }
    } catch { setSaveStatus('failed'); }
  }, [settings.storageMode]);

  const updateSettings = (patch: Partial<AppSettings>) => setSettings((s) => ({ ...s, ...patch }));

  const formatPrice = (price: number) => {
    const symbol = settings.currency === 'CHF' ? 'CHF' : settings.currency === 'EUR' ? '€' : '$';
    return price === 0 ? 'Gratis' : `${symbol} ${price.toFixed(2).replace('.', ',')}`;
  };

  const selectTier = (tier: SubscriptionTier) => {
    if (tier === 'free') { setSettings((s) => ({ ...s, subscriptionTier: 'free' })); setActionNotice('Auf kostenlos gewechselt'); return; }
    setPurchaseDialog({ tier, interval: settings.billingInterval });
  };

  const confirmPurchase = () => {
    if (!purchaseDialog) return;
    const tier = purchaseDialog.tier;
    setSettings((s) => ({ ...s, subscriptionTier: tier, hasSeenReactivationOffer: true, smartKIMode: tier === 'smart-ki' || tier === 'komplett' ? true : s.smartKIMode }));
    setPurchaseSuccess(tierInfo[tier].name + ' aktiviert! (Demo)');
    setActionNotice(tierInfo[tier].name + ' aktiviert');
    window.setTimeout(() => {
      setPurchaseDialog(null);
      setPurchaseSuccess(null);
      setTrialOffer(false);
      setBookletUpgrade(false);
    }, 1800);
  };

  const resetTestState = () => {
    const end = new Date(); end.setDate(end.getDate() + 30);
    setSettings((s) => ({ ...s, subscriptionTier: 'free', trialEndDate: end.toISOString(), bookletCount: 0, hasSeenReactivationOffer: false, smartKIMode: false }));
    setActionNotice('Gratismonat neu gestartet');
  };

  const exportBackup = () => {
    const data = { workspace, settings: { ...settings, protectionValue: '', protectionSalt: '', protectionHash: '' }, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `universum-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setActionNotice('Backup heruntergeladen');
  };

  const factoryReset = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem(LAST_EDIT_KEY);
    localStorage.removeItem(LAST_SAVE_KEY);
    setWorkspace(defaultWorkspace);
    setSettings(defaultSettings);
    setOnboarding(true);
    setSettingsOpen(false);
    setActionNotice('Werkseinstellung durchgeführt');
  };

  const clearCache = () => {
    void clearLocalAttachments().catch(() => {});
    setLoadedAtt({});
    setWorkspace((w) => ({ ...w, categories: w.categories.map((c) => ({ ...c, chats: c.chats.map((ch) => ({ ...ch, notes: ch.notes.map((n) => ({ ...n, attachments: [] })) })) })) }));
    setActionNotice('Anhänge entfernt'); setClearCacheConfirm(false);
  };

  /* Signing out must end the session AND remove the notes this account left on
     the device, otherwise the next person to open the app sees them and the
     autosave writes them into whichever account signs in next. */
  const handleSignOut = async () => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    await signOut();
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem(LAST_EDIT_KEY);
    localStorage.removeItem(LAST_SAVE_KEY);
    workspaceRef.current = defaultWorkspace;
    isDirtyRef.current = false;
    setWorkspace(defaultWorkspace);
    setSettings(defaultSettings);
    setSaveStatus('offline');
    setSettingsOpen(false);
    setLocked(false);
    setOnboarding(true);
    setActionNotice('Abgemeldet');
  };

  const computeCacheStats = useCallback(() => {
    let items = 0; let sizeKb = 0;
    workspace.categories.forEach((c) => c.chats.forEach((ch) => ch.notes.forEach((n) => {
      (n.attachments ?? []).forEach((a) => { items++; sizeKb += a.size ?? 0; });
    })));
    setCacheStats({ items, sizeKb });
  }, [workspace]);

  useEffect(() => { void computeCacheStats(); }, [computeCacheStats]);

  const updateChat = (chatId: string, categoryId: string, patch: Partial<SubChat>) => {
    setWorkspace((cur) => ({ ...cur, categories: cur.categories.map((c) => c.id !== categoryId ? c : { ...c, chats: c.chats.map((ch) => ch.id !== chatId ? ch : { ...ch, ...patch, updatedAt: new Date().toISOString() }) }) }));
  };

  const updateNote = (noteId: string, categoryId: string, chatId: string, patch: Partial<NoteItem>) => {
    setWorkspace((cur) => ({ ...cur, categories: cur.categories.map((c) => c.id !== categoryId ? c : { ...c, chats: c.chats.map((ch) => ch.id !== chatId ? ch : { ...ch, notes: ch.notes.map((n) => n.id !== noteId ? n : { ...n, ...patch, updatedAt: new Date().toISOString() }), updatedAt: new Date().toISOString() }) }) }));
  };

  const updateActiveNoteContent = (value: string) => {
    if (!activeNote || !activeCategory || !activeChat) return;
    updateNote(activeNote.id, activeCategory.id, activeChat.id, { content: value });
  };

  const selectChat = (categoryId: string, chatId: string) => {
    if (isDirtyRef.current) void saveToCloud();
    setActiveCategoryId(categoryId); setActiveChatId(chatId); setActiveNoteId(null);
    const cat = workspace.categories.find((c) => c.id === categoryId);
    setSubChatDraft(cat?.chats.find((ch) => ch.id === chatId)?.title ?? '');
    setSidebarOpen(false); setColorPickerOpen(false);
  };

  const toggleCategory = (id: string) => setWorkspace((cur) => ({ ...cur, categories: cur.categories.map((c) => c.id === id ? { ...c, open: !c.open } : c) }));

  const createCategory = () => {
    if (!newCategory.title.trim()) return;
    const cat: Category = { id: `category-${Date.now()}`, title: newCategory.title.trim(), emoji: newCategory.emoji, color: newCategory.color, open: true, chats: [] };
    setWorkspace((cur) => ({ ...cur, categories: [...cur.categories, cat] }));
    setActiveCategoryId(cat.id); setActiveChatId(''); setActiveNoteId(null);
    setCategoryDialog(false); setNewCategory({ title: '', emoji: '🌿', color: '#6f9270' });
  };

  const createSubChat = () => {
    const title = subChatDraft.trim();
    if (!title || !activeCategory) return;
    if (activeChat && activeChat.title === title) return;
    const existing = activeCategory.chats.find((ch) => ch.title.toLowerCase() === title.toLowerCase());
    const chat: SubChat = existing ?? { id: `chat-${Date.now()}`, title, notes: [], updatedAt: new Date().toISOString() };
    setWorkspace((cur) => ({ ...cur, categories: cur.categories.map((c) => c.id !== activeCategory.id ? c : { ...c, open: true, chats: existing ? c.chats : [...c.chats, chat] }) }));
    setActiveChatId(chat.id); setActiveNoteId(null);
  };

  const createNote = () => {
    if (!activeChat || !activeCategory) return;
    if (noteLimitReached) return;
    const note = makeNote('', language);
    updateChat(activeChat.id, activeCategory.id, { notes: [...activeChat.notes, note] });
    setActiveNoteId(note.id);
  };

  const deleteNote = (noteId: string) => {
    if (!activeChat || !activeCategory) return;
    updateChat(activeChat.id, activeCategory.id, { notes: activeChat.notes.filter((n) => n.id !== noteId) });
    if (activeNoteId === noteId) setActiveNoteId(null);
    setDeleteConfirm(null);
  };

  const duplicateNote = (noteId: string) => {
    if (!activeChat || !activeCategory) return;
    const note = activeChat.notes.find((n) => n.id === noteId);
    if (!note) return;
    const copy: NoteItem = { ...note, id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    updateChat(activeChat.id, activeCategory.id, { notes: [...activeChat.notes, copy] });
    setManageMenu(null);
  };

  const copyNoteText = async () => {
    if (!activeNote) return;
    const att = noteAttachments.map((a) => a.name).join(', ');
    const text = `[${new Date(activeNote.createdAt).toLocaleDateString('de-DE')} | ${activeCategory?.title ?? 'Universum'} → ${activeChat?.title ?? 'Notiz'}]${att ? ` [${att}]` : ''}\n${noteContent || 'Noch keine Notiz'}`;
    await navigator.clipboard.writeText(text);
    setActionNotice('Notiz kopiert');
  };

  const runFactCheck = () => {
    if (!activeNote || !activeCategory || !activeChat) return;
    const { id, content } = activeNote;
    const cid = activeCategory.id; const chid = activeChat.id;
    updateNote(id, cid, chid, { factCheckStatus: 'checking', sources: [] });
    setDismissedFacts(new Set());
    window.setTimeout(() => {
      const found = checkFacts(content);
      updateNote(id, cid, chid, { factCheckStatus: 'done', sources: found });
    }, 50);
  };

  const activeFindings = useMemo(() => facts.filter((f) => !dismissedFacts.has(f.claim)), [facts, dismissedFacts]);

  const applyFactCorrection = (finding: FactFinding) => {
    if (!activeNote || !activeCategory || !activeChat || !finding.matchedText) return;
    const newContent = noteContent.replace(finding.matchedText, finding.correctedText);
    updateNote(activeNote.id, activeCategory.id, activeChat.id, { content: newContent });
    setDismissedFacts((prev) => new Set(prev).add(finding.claim));
    setFactModal(null);
    setActionNotice('Korrektur übernommen');
  };

  const ignoreFact = (finding: FactFinding) => {
    setDismissedFacts((prev) => new Set(prev).add(finding.claim));
    setFactModal(null);
    setActionNotice('Markierung ignoriert');
  };

  const applyManualEdit = () => {
    if (!activeNote || !activeCategory || !activeChat || !factModal) return;
    if (factModal.matchedText && manualEditValue.trim()) {
      const newContent = noteContent.replace(factModal.matchedText, manualEditValue.trim());
      updateNote(activeNote.id, activeCategory.id, activeChat.id, { content: newContent });
      setDismissedFacts((prev) => new Set(prev).add(factModal.claim));
      setActionNotice('Text manuell angepasst');
    }
    setShowManualEdit(false);
    setFactModal(null);
  };

  const buildHighlightedContent = (): Array<{ text: string; fact?: FactFinding }> => {
    if (!activeFindings.length) return [{ text: noteContent }];
    const segments: Array<{ text: string; fact?: FactFinding }> = [];
    let remaining = noteContent;
    const sorted = [...activeFindings].sort((a, b) => {
      const ia = remaining.indexOf(a.matchedText);
      const ib = remaining.indexOf(b.matchedText);
      return ia - ib;
    });
    while (remaining.length > 0 && sorted.length > 0) {
      const fact = sorted.shift()!;
      const idx = remaining.indexOf(fact.matchedText);
      if (idx < 0) continue;
      if (idx > 0) segments.push({ text: remaining.slice(0, idx) });
      segments.push({ text: remaining.slice(idx, idx + fact.matchedText.length), fact });
      remaining = remaining.slice(idx + fact.matchedText.length);
    }
    if (remaining.length > 0) segments.push({ text: remaining });
    return segments;
  };

  const toggleRecording = () => {
    if (recording) { pausedRef.current = false; recognitionRef.current?.stop(); setRecording(false); return; }
    const SRC = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SRC) { setActionNotice('Spracheingabe nicht unterstützt'); return; }
    const rec = new SRC();
    rec.lang = language === 'Schweizerdeutsch' ? 'de-CH' : language === 'English' ? 'en-US' : language === 'Français' ? 'fr-FR' : language === 'Italiano' ? 'it-IT' : language === 'Español' ? 'es-ES' : 'de-DE';
    rec.continuous = true; rec.interimResults = true;
    let finalText = noteContent;
    rec.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) { const corrected = correctTranscript(result[0].transcript.trim()); finalText = `${finalText}${finalText ? ' ' : ''}${corrected}`; }
        else interim += result[0].transcript;
      }
      updateActiveNoteContent(`${finalText}${interim ? `${finalText ? ' ' : ''}${interim}` : ''}`);
    };
    rec.onend = () => { if (!pausedRef.current) setRecording(false); };
    rec.onerror = () => { setActionNotice('Mikrofon nicht verfügbar'); setRecording(false); };
    recognitionRef.current = rec; rec.start(); setRecording(true);
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !activeNote || !activeCategory || !activeChat) return;
    setUploading(true);
    try {
      const newRefs: AttachmentRef[] = [];
      let rejected = 0;
      for (const file of Array.from(files)) {
        if (!isAllowedAttachment(file)) { rejected += 1; continue; }
        const compressed = await compressMedia(file);
        const ref = await storeAttachment(compressed.dataUrl, { id: compressed.id, name: compressed.name, type: compressed.type, size: compressed.size, duration: compressed.duration, poster: compressed.poster }, attMode);
        setLoadedAtt((prev) => ({ ...prev, [ref.id]: compressed.dataUrl }));
        newRefs.push(ref);
      }
      if (newRefs.length === 0) {
        setActionNotice(rejected ? 'Datei zu gross oder Format nicht erlaubt' : 'Keine Datei ausgewählt');
        return;
      }
      const combined = [...noteAttachments, ...newRefs];
      updateNote(activeNote.id, activeCategory.id, activeChat.id, { attachments: combined });
      setActionNotice(rejected
        ? `${newRefs.length} hinzugefügt · ${rejected} abgelehnt`
        : `${newRefs.length} ${newRefs.length === 1 ? 'Anhang' : 'Anhänge'} hinzugefügt`);
    } catch { setActionNotice('Upload fehlgeschlagen'); }
    finally { setUploading(false); }
  };

  const removeAttachment = (id: string) => {
    if (!activeNote || !activeCategory || !activeChat) return;
    const att = noteAttachments.find((a) => a.id === id);
    if (att?.storageKey) void deleteAttachment(att, attMode).catch(() => {});
    setLoadedAtt((prev) => { const next = { ...prev }; delete next[id]; return next; });
    updateNote(activeNote.id, activeCategory.id, activeChat.id, { attachments: noteAttachments.filter((a) => a.id !== id) });
  };

  const toggleChatRecording = () => {
    if (chatRecording) { chatRecognitionRef.current?.stop(); setChatRecording(false); return; }
    const SRC = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SRC) { setActionNotice('Spracheingabe nicht unterstützt'); return; }
    const rec = new SRC();
    rec.lang = language === 'Schweizerdeutsch' ? 'de-CH' : language === 'English' ? 'en-US' : language === 'Français' ? 'fr-FR' : language === 'Italiano' ? 'it-IT' : language === 'Español' ? 'es-ES' : 'de-DE';
    rec.continuous = false; rec.interimResults = true;
    let finalText = '';
    rec.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interim += result[0].transcript;
      }
      setChatInput(`${finalText}${interim}`);
    };
    rec.onend = () => { setChatRecording(false); };
    rec.onerror = () => { setActionNotice('Mikrofon nicht verfügbar'); setChatRecording(false); };
    chatRecognitionRef.current = rec; rec.start(); setChatRecording(true);
  };

  const sendChatMessage = () => {
    const text = chatInput.trim();
    if (!text || !activeChat || !activeCategory) return;
    const userMsg: ChatMessage = { id: `msg-${Date.now()}`, role: 'user', text, createdAt: new Date().toISOString() };
    const updated = [...chatMessages, userMsg];
    updateChat(activeChat.id, activeCategory.id, { messages: updated });
    setChatInput(''); setChatThinking(true);
    window.setTimeout(() => {
      const writingSamples = workspace.categories
        .flatMap((c) => c.chats.flatMap((ch) => ch.notes.map((n) => n.content).filter((t) => t.trim().length > 20)))
        .slice(-20);
      const config: AiModelConfig = {
        model: settings.aiModel,
        behaviorProfile: settings.companionProfile as ChatBehaviorProfile,
        memoryMode: settings.memoryMode,
        masterEnabled: settings.masterEnabled,
        writingSamples,
      };
      const resp = generateChatResponse(text, updated, workspace.name, config);
      const aMsg: ChatMessage = { id: `msg-${Date.now()}-a`, role: 'assistant', text: resp.text, sources: resp.sources, createdAt: new Date().toISOString() };
      if (activeChat && activeCategory) updateChat(activeChat.id, activeCategory.id, { messages: [...updated, aMsg] });
      setChatThinking(false);
    }, 50);
  };

  const deleteCategory = (id: string) => {
    setWorkspace((cur) => ({ ...cur, categories: cur.categories.filter((c) => c.id !== id) }));
    if (activeCategoryId === id) { const r = workspace.categories.filter((c) => c.id !== id); if (r[0]) { setActiveCategoryId(r[0].id); setActiveChatId(r[0].chats[0]?.id ?? ''); setActiveNoteId(null); } }
    setDeleteConfirm(null);
  };

  const deleteChat = (categoryId: string, chatId: string) => {
    setWorkspace((cur) => ({ ...cur, categories: cur.categories.map((c) => c.id !== categoryId ? c : { ...c, chats: c.chats.filter((ch) => ch.id !== chatId) }) }));
    if (activeChatId === chatId) { const cat = workspace.categories.find((c) => c.id === categoryId); const r = cat?.chats.filter((ch) => ch.id !== chatId) ?? []; setActiveChatId(r[0]?.id ?? ''); setActiveNoteId(null); }
    setDeleteConfirm(null);
  };

  const copyChat = (categoryId: string, chatId: string) => {
    const cat = workspace.categories.find((c) => c.id === categoryId);
    const chat = cat?.chats.find((ch) => ch.id === chatId);
    if (!chat) return;
    const copy: SubChat = { ...chat, id: `chat-${Date.now()}`, title: `${chat.title} (Kopie)`, notes: chat.notes.map((n) => ({ ...n, id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })), updatedAt: new Date().toISOString() };
    setWorkspace((cur) => ({ ...cur, categories: cur.categories.map((c) => c.id !== categoryId ? c : { ...c, chats: [...c.chats, copy] }) }));
    setManageMenu(null);
  };

  const moveChat = (chatId: string, fromCat: string, toCat: string) => {
    const fromC = workspace.categories.find((c) => c.id === fromCat);
    const chat = fromC?.chats.find((ch) => ch.id === chatId);
    if (!chat) return;
    setWorkspace((cur) => ({ ...cur, categories: cur.categories.map((c) => { if (c.id === fromCat) return { ...c, chats: c.chats.filter((ch) => ch.id !== chatId) }; if (c.id === toCat) return { ...c, open: true, chats: [...c.chats, chat] }; return c; }) }));
    setActiveCategoryId(toCat); setActiveChatId(chatId); setActiveNoteId(null); setMoveDialog(null);
  };

  const generateBooklet = (): string => {
    if (!activeCategory || !activeChat) return '';
    const notes = [...activeChat.notes].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const sep = bookletOptions.layout === 'Modern' ? '─'.repeat(50) : bookletOptions.layout === 'Tagebuch' ? '✦ ✦ ✦' : '═'.repeat(50);
    const lines: string[] = [`${activeCategory.emoji} ${activeCategory.title} → ${activeChat.title}`, sep, ''];
    const toneIntro = bookletOptions.tonalitaet === 'Sachlich' ? '' : bookletOptions.tonalitaet === 'Poetisch' ? 'Ein stilles Bild aus Worten.\n' : 'Wie erzählt am Küchentisch.\n';
    lines.push(toneIntro);
    for (const n of notes) {
      const d = new Date(n.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
      lines.push(d);
      if (bookletOptions.initialen && n.content) { lines.push(`❦ ${n.content.charAt(0).toUpperCase()}${n.content.slice(1)}`); } else { lines.push(n.content || '—'); }
      if (n.attachments?.length) lines.push(`[Anhänge: ${n.attachments.map((a) => a.name).join(', ')}]`);
      lines.push('', sep, '');
    }
    return lines.join('\n');
  };

  const adoptChatToNote = (msgText: string) => {
    if (!activeNote || !activeCategory || !activeChat) return;
    const adopted = noteContent ? `${noteContent}\n\n[KI-Notiz] ${msgText}` : `[KI-Notiz] ${msgText}`;
    updateNote(activeNote.id, activeCategory.id, activeChat.id, { content: adopted });
    setActionNotice('KI-Antwort in Notiz übernommen');
  };

  const renameCategory = (categoryId: string, newName: string) => {
    const name = newName.trim();
    if (!name) return;
    setWorkspace((cur) => ({ ...cur, categories: cur.categories.map((c) => c.id !== categoryId ? c : { ...c, title: name }) }));
    setRenameTarget(null);
  };

  const renameChat = (categoryId: string, chatId: string, newName: string) => {
    const name = newName.trim();
    if (!name) return;
    setWorkspace((cur) => ({ ...cur, categories: cur.categories.map((c) => c.id !== categoryId ? c : { ...c, chats: c.chats.map((ch) => ch.id !== chatId ? ch : { ...ch, title: name }) }) }));
    if (activeChatId === chatId) setSubChatDraft(name);
    setRenameTarget(null);
  };

  const pauseRecording = () => {
    if (recordingPaused) { pausedRef.current = false; try { recognitionRef.current?.start(); } catch { /* still stopping */ } setRecordingPaused(false); }
    else { pausedRef.current = true; recognitionRef.current?.stop(); setRecordingPaused(true); }
  };

  const stopRecording = () => {
    pausedRef.current = false; recognitionRef.current?.stop(); setRecording(false); setRecordingPaused(false);
  };

  const handleOcrUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setUploading(true); setOcrProcessing(true);
    try {
      const compressed = await compressImage(file);
      setOcrImage(compressed.dataUrl);
      const sampleTexts = [
        'Heute war ein schöner Tag im Stall. Die Kühe haben gut gefressen und die Kälber waren munter.',
        'Maine Coon Wurfplanung: Deckung Ende Oktober, Wurf erwartet im Dezember. Farben: Rot & Braun Tabby.',
        'Einkaufsliste für nächste Woche: Heu, Kraftfutter, Vitamine, neue Tränken für Stall 2.',
        'Notiz an mich selbst: Tierarzttermin für Hermine am Dienstag um 14 Uhr nicht vergessen!',
      ];
      const numSegs = 2 + Math.floor(Math.random() * 3);
      const shuffled = [...sampleTexts].sort(() => Math.random() - 0.5).slice(0, numSegs);
      setOcrSegments(shuffled.map((text, i) => ({ id: `seg-${i}`, text, selected: true })));
    } catch { setActionNotice('Bild konnte nicht geladen werden'); }
    finally { setUploading(false); setOcrProcessing(false); }
  };

  const adoptOcrSelection = () => {
    if (!activeNote || !activeCategory || !activeChat) return;
    const selected = ocrSegments.filter((s) => s.selected);
    if (selected.length === 0) return;
    const text = selected.map((s) => s.text).join('\n\n');
    updateNote(activeNote.id, activeCategory.id, activeChat.id, { content: noteContent ? `${noteContent}\n\n[Handschrift] ${text}` : `[Handschrift] ${text}` });
    setActionNotice('Handschrift übernommen');
    setOcrDialog(false); setOcrImage(null); setOcrSegments([]);
  };

  const completeOnboarding = async (result: { storageMode: StorageMode; email?: string; protection: ProtectionType; protectionValue: string; uiLang: UiLang }) => {
    const langMap: Record<UiLang, string> = { en: 'English', de: 'Hochdeutsch', 'de-ch': 'Schweizerdeutsch', fr: 'Français', it: 'Italiano', es: 'Español' };
    const editorLang = langMap[result.uiLang] ?? 'English';
    // Hash the chosen lock secret immediately; the cleartext is never stored.
    const prot = result.protection !== 'none' && result.protectionValue
      ? await makeProtectionHash(result.protectionValue)
      : { salt: '', hash: '' };
    const trialEnd = new Date(); trialEnd.setDate(trialEnd.getDate() + 30);
    setSettings((s) => ({ ...s, onboarded: true, uiLang: result.uiLang, language: editorLang, protection: result.protection, protectionValue: '', protectionSalt: prot.salt, protectionHash: prot.hash, storageMode: result.storageMode, userEmail: result.email ?? null, trialEndDate: s.trialEndDate ?? trialEnd.toISOString() }));
    setLanguage(editorLang);
    setOnboarding(false);
    if (result.protection !== 'none') setLocked(true);
  };

  const unlockApp = async () => {
    const candidate = lockInput;
    if (!candidate) { setLockError(true); return; }

    // Preferred path: compare digests, never cleartext.
    if (settings.protectionHash && settings.protectionSalt) {
      const digest = await hashSecret(candidate, settings.protectionSalt);
      if (digest === settings.protectionHash) { setLocked(false); setLockInput(''); setLockError(false); }
      else { setLockError(true); }
      return;
    }

    // Migration path: a lock set up before hashing existed. Verify against the
    // stored cleartext once, then replace it with a salted digest so the
    // cleartext secret stops being persisted.
    if (settings.protectionValue && candidate === settings.protectionValue) {
      const { salt, hash } = await makeProtectionHash(candidate);
      setSettings((s) => ({ ...s, protectionSalt: salt, protectionHash: hash, protectionValue: '' }));
      setLocked(false); setLockInput(''); setLockError(false);
      return;
    }

    setLockError(true);
  };

  const copyBooklet = async () => {
    await navigator.clipboard.writeText(generateBooklet());
    setSettings((s) => ({ ...s, bookletCount: s.bookletCount + 1 }));
    setActionNotice('Büchlein kopiert');
    setBookletDialog(false);
  };

  const commitRename = () => {
    if (!renameTarget) return;
    if (renameTarget.type === 'category') renameCategory(renameTarget.categoryId, renameValue);
    else if (renameTarget.chatId) renameChat(renameTarget.categoryId, renameTarget.chatId, renameValue);
  };
  const renameOnEnter = (e: { key: string }) => { if (e.key === 'Enter') commitRename(); };

  const closeOcr = () => { setOcrDialog(false); setOcrImage(null); setOcrSegments([]); };
  const setProtectionPin = () => { setProtectionDialog({ mode: 'setup', type: 'pin', value: '' }); };
  const setProtectionPassword = () => { setProtectionDialog({ mode: 'setup', type: 'password', value: '' }); };
  const changeProtection = () => { setProtectionDialog({ mode: 'change', type: settings.protection, value: '' }); };
  const confirmProtectionDialog = async () => {
    if (!protectionDialog) return;
    const val = protectionDialog.value.trim();
    if (!val) return;
    if (protectionDialog.type === 'pin' && !/^\d{4,6}$/.test(val)) return;
    const { salt, hash } = await makeProtectionHash(val);
    updateSettings({ protection: protectionDialog.type, protectionValue: '', protectionSalt: salt, protectionHash: hash });
    setProtectionDialog(null);
    setActionNotice(protectionDialog.mode === 'change' ? 'Schutz aktualisiert' : 'Schutz aktiviert');
  };

  const categoryAbbrev = useMemo(() => {
    if (!activeCategory) return '';
    const words = activeCategory.title.replace(/&/g, ' ').trim().split(/\s+/).filter((w) => w.length > 0 && !['&', 'und', 'oder'].includes(w.toLowerCase()));
    return words.length >= 2 ? (words[0][0] + words[1][0]).toUpperCase() : activeCategory.title.slice(0, 2).toUpperCase();
  }, [activeCategory]);

  const emojiOptions = ['🌿','🐈', '🐄', '🐕', '🧬', '🌾', '🥕', '🧰', '📋', '🏡', '☼', '⭐', '🌸', '🐝', '🐰', '🐔', '🍂', '❄️', '🌷', '🌻', '🦋', '🐌', '🥬', '🍎', '🍐', '🍇', '🍓', '🫐', '🍳', '🥛', '🍞', '🧀', '📚', '✏️', '🎨', '🎶', '🏡', '🚗', '✈️', '⛵', '🎣', '🎁', '💐', '💍', '👶', '🎂', '🎄', '🎃', '🥳', '💪', '🧘', '☀️', '🌙', '⭐', '🔥', '💧', '🌈', '❤️', '💚', '💛'];
  const emojiKeywords: Record<string, string[]> = {
    '🌿': ['pflanze', 'kraut', 'natur', 'grün', 'garten', 'plant', 'herb', 'green', 'nature'],
    '🐈': ['katze', 'kater', 'tier', 'cat', 'kitten'],
    '🐄': ['kuh', 'rind', 'vieh', 'cow', 'cattle', 'rinder'],
    '🐕': ['hund', 'dog', 'tier'],
    '🧬': ['genetik', 'dna', 'biologie', 'genetics', 'biology'],
    '🌾': ['getreide', 'feld', 'ernte', 'grain', 'field', 'harvest', 'wheat'],
    '🥕': ['gemüse', 'möhre', 'karotte', 'vegetable', 'carrot'],
    '🧰': ['werkzeug', 'kiste', 'tool', 'box', 'werkstatt'],
    '📋': ['liste', 'plan', 'clipboard', 'list', 'plan'],
    '🏡': ['haus', 'home', 'haus', 'hof', 'farm'],
    '☼': ['sonne', 'wetter', 'sun', 'weather'],
    '⭐': ['stern', 'favorit', 'star', 'favorite'],
    '🌸': ['blume', 'frühling', 'flower', 'spring', 'blossom'],
    '🐝': ['biene', 'imkerei', 'bee', 'honey'],
    '🐰': ['kaninchen', 'rabbit', 'bunny', 'hase'],
    '🐔': ['huhn', 'huhn', 'geflügel', 'chicken', 'poultry'],
    '🍂': ['herbst', 'laub', 'autumn', 'fall', 'leaves'],
    '❄️': ['winter', 'schnee', 'kalt', 'snow', 'winter', 'cold'],
    '🌷': ['tulpe', 'blume', 'tulip', 'flower'],
    '🌻': ['sonnenblume', 'blume', 'sunflower', 'flower'],
    '🦋': ['schmetterling', 'butterfly'],
    '🐌': ['schnecke', 'snail'],
    '🥬': ['salat', 'blatt', 'lettuce', 'salad', 'leaf'],
    '🍎': ['apfel', 'obst', 'apple', 'fruit'],
    '🍐': ['birne', 'obst', 'pear', 'fruit'],
    '🍇': ['trauben', 'obst', 'grapes', 'fruit', 'wine'],
    '🍓': ['erdbeere', 'obst', 'strawberry', 'fruit'],
    '🫐': ['heidelbeere', 'obst', 'blueberry', 'fruit', 'beere'],
    '🍳': ['ei', 'kochen', 'frühstück', 'egg', 'cooking', 'breakfast'],
    '🥛': ['milch', 'drink', 'milk', 'dairy'],
    '🍞': ['brot', 'bäckerei', 'bread', 'bakery'],
    '🧀': ['käse', 'dairy', 'cheese'],
    '📚': ['bücher', 'lesen', 'wissen', 'books', 'reading', 'study'],
    '✏️': ['schreiben', 'stift', 'write', 'pen', 'pencil'],
    '🎨': ['kunst', 'malen', 'art', 'paint', 'creative', 'design'],
    '🎶': ['musik', 'note', 'music', 'song'],
    '🚗': ['auto', 'auto', 'car', 'drive'],
    '✈️': ['flug', 'reise', 'flugzeug', 'flight', 'travel', 'plane'],
    '⛵': ['boot', 'schiff', 'wasser', 'boat', 'ship', 'sailing'],
    '🎣': ['angeln', 'fisch', 'fishing', 'fish'],
    '🎁': ['geschenk', 'feier', 'gift', 'present'],
    '💐': ['blumenstrauß', 'blumen', 'bouquet', 'flowers'],
    '💍': ['ring', 'schmuck', 'hochzeit', 'ring', 'jewelry', 'wedding'],
    '👶': ['baby', 'kind', 'baby', 'child'],
    '🎂': ['geburtstag', 'kuchen', 'birthday', 'cake'],
    '🎄': ['weihnachten', 'baum', 'christmas', 'tree'],
    '🎃': ['halloween', 'kürbis', 'pumpkin'],
    '🥳': ['feier', 'party', 'celebration', 'geburtstag'],
    '💪': ['stärke', 'sport', 'fitness', 'strength', 'sport', 'workout'],
    '🧘': ['meditation', 'yoga', 'ruhe', 'meditation', 'calm'],
    '☀️': ['sonne', 'wetter', 'sun', 'weather', 'sommer'],
    '🌙': ['mond', 'nacht', 'moon', 'night'],
    '🔥': ['feuer', 'heiß', 'fire', 'hot'],
    '💧': ['wasser', 'tropfen', 'water', 'drop'],
    '🌈': ['regenbogen', 'farben', 'rainbow'],
    '❤️': ['herz', 'liebe', 'heart', 'love'],
    '💚': ['herz', 'grün', 'heart', 'green', 'love'],
    '💛': ['herz', 'gelb', 'heart', 'yellow', 'love'],
  };
  const colorOptions = ['#6f9270', '#cfaa63', '#8797aa', '#c0473e', '#3d6b8a', '#b07840', '#7a6b9a', '#5a8a6a', '#d97559', '#a8c5b8', '#d4a574', '#b8a9c8', '#e8a87c', '#85b8d1', '#c9b1d0', '#7da88f', '#d4b896', '#a06565', '#5c8a8a', '#3a3a3a'];
  const categoryCount = useMemo(() => workspace.categories.length.toString().padStart(2, '0'), [workspace.categories.length]);
  const saveStatusText = { idle: 'Änderungen werden automatisch gemerkt', saving: 'Wird gespeichert …', saved: 'Änderungen lokal gesichert', offline: 'Offline gespeichert', failed: 'Speichern fehlgeschlagen' }[saveStatus];
  const fmtDate = (iso: string) => new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

  return (
    <div className="app-shell" onClick={() => { if (manageMenu) setManageMenu(null); }}>
      <header className="topbar">
        <button className="icon-button mobile-only" onClick={() => setSidebarOpen(true)} aria-label="Menü"><Menu size={20} /></button>
        <div className="brand-mark" style={{ background: `linear-gradient(135deg, ${activeCategory ? activeCategory.color : "#2d4337"}, #213528)` }}><span className="brand-initial">{displayInitial}</span></div>
        <div className="brand-copy"><span className="eyebrow">DEIN PERSÖNLICHES</span><strong>{workspace.name.trim() ? `${workspace.name.trim()}s Universum` : 'Dein persönliches Universum'}</strong></div>
        <div className="topbar-actions">
          <button className="quiet-button chat-toggle" onClick={() => setChatOpen(true)}><MessageCircle size={16} /> {t(settings.uiLang, 'quickChat')}</button>
          <button className="quiet-button" onClick={() => setShowWelcome(true)}><PanelLeft size={16} /> {t(settings.uiLang, 'overview')}</button>
          <button className="quiet-button settings-btn" onClick={() => setSettingsOpen(true)}><SettingsIcon size={16} /> {t(settings.uiLang, 'settings')}</button>
          <button className="avatar" style={{ background: `linear-gradient(135deg, ${activeCategory ? activeCategory.color : "#2d4337"}, #213528)` }} onClick={() => setShowWelcome(true)}>{displayInitial}</button>
        </div>
      </header>

      <div className="workspace-grid">
        <aside className={`sidebar ${sidebarOpen ? 'is-open' : ''}`}>
          <div className="sidebar-head"><div><span className="section-label">01 UNIVERSUM</span><h2>Bereiche</h2></div><button className="icon-button" onClick={() => setSidebarOpen(false)}><X size={18} /></button></div>
          <label className="name-field"><span>Wie heißt dein Universum?</span><input value={workspace.name} onChange={(e) => setWorkspace((c) => ({ ...c, name: e.target.value }))} /></label>
          <div className="category-list">
            {workspace.categories.map((cat) => <div className="category-block" key={cat.id}>
              <div className="category-row-wrapper">
                <button className="category-row" onClick={() => toggleCategory(cat.id)}>
                  <span className="category-icon" style={{ backgroundColor: `${cat.color}22`, color: cat.color }}>{cat.emoji}</span>
                  <span className="category-title">{cat.title}</span>
                  {cat.color && <span className="color-dot" style={{ backgroundColor: cat.color }} />}
                  <ChevronDown size={15} className={cat.open ? 'rotate-180' : ''} />
                </button>
                <button className="manage-button" onClick={(e) => { e.stopPropagation(); setManageMenu({ type: 'category', categoryId: cat.id, x: e.clientX, y: e.clientY }); }}><MoreHorizontal size={15} /></button>
              </div>
              {cat.open && <div className="chat-list">{cat.chats.map((ch) => <div className="chat-row-wrapper" key={ch.id}>
                <button className={`chat-row ${activeChatId === ch.id && activeCategoryId === cat.id ? 'active' : ''}`} onClick={() => selectChat(cat.id, ch.id)}>
                  <Hash size={13} /><span>{ch.title}</span>
                  {ch.color && <span className="color-dot-sm" style={{ backgroundColor: ch.color }} />}
                  {ch.notes.length > 0 && <span className="attach-badge">{ch.notes.length}</span>}
                </button>
                <button className="manage-button-sm" onClick={(e) => { e.stopPropagation(); setManageMenu({ type: 'chat', categoryId: cat.id, chatId: ch.id, x: e.clientX, y: e.clientY }); }}><MoreHorizontal size={13} /></button>
              </div>)}<button className="new-chat-row" onClick={() => { setActiveCategoryId(cat.id); setSubChatDraft(''); setSidebarOpen(false); setActiveNoteId(null); }}><Plus size={13} /> Unterthema hinzufügen</button></div>}
            </div>)}
          </div>
          <button className="new-category-button" onClick={() => setCategoryDialog(true)}><Plus size={16} /> Neue Kategorie</button>
          <div className="sidebar-bottom"><div className="memory-card"><Archive size={17} /><div><strong>Universum-Gedächtnis</strong><span>Alles bleibt verbunden.</span></div><span className="live-dot" /></div><span className="sidebar-version">{categoryCount} BEREICHE · LOKAL & SICHER</span></div>
        </aside>
        {sidebarOpen && <button className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

        <main className="main-content">
          <div className="welcome-line"><div><span className="eyebrow">{greeting.toUpperCase()} {workspace.name.trim().toUpperCase()}</span><h1>Worüber reden wir heute?</h1></div><div className="date-chip"><span>HEUTE</span><strong>{new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short' }).format(new Date())}</strong></div></div>
          {activeChat && <div className="category-header"><span className="category-emoji" style={{ backgroundColor: `${activeCategory.color}22`, color: activeCategory.color }}>{activeCategory.emoji}</span><div><span className="eyebrow">KATEGORIE · {categoryAbbrev}</span><h2 className="category-name">{activeCategory.title}</h2></div>{activeChat.color && <span className="color-bar" style={{ backgroundColor: activeChat.color }} />}<button className="booklet-btn" onClick={() => setBookletDialog(true)}><BookOpen size={16} /> Büchlein-Werkstatt</button></div>}
          {!activeChat ? <div className="empty-card"><Sprout size={30} /><h2>{workspace.categories.length === 0 ? 'Dein Universum ist noch leer.' : t(settings.uiLang, 'emptyTitle')}</h2><p>{workspace.categories.length === 0 ? 'Erstelle links deine erste Kategorie und leg los.' : t(settings.uiLang, 'emptyDesc')}</p><button className="primary-button" onClick={() => setSidebarOpen(true)}>{workspace.categories.length === 0 ? <>Kategorie erstellen <Plus size={16} /></> : <>{t(settings.uiLang, 'createSubtopic')} <ArrowLeft size={16} className="flip-x" /></>}</button></div> : <>
            <section className="editor-card">
              <div className="editor-heading"><div><span className="section-label">02 UNTERTHEMA / SUB-CHAT</span><p className="helper-text">Jedes neue Thema wird automatisch als eigener Sub-Chat geführt.</p></div><div className="heading-actions"><span className="step-number">02</span><button className="color-pick-btn" onClick={() => setColorPickerOpen((v) => !v)}><span className="color-dot" style={{ backgroundColor: activeChat.color ?? 'transparent' }} /></button></div></div>
              {colorPickerOpen && <div className="color-picker-row">{colorOptions.map((c) => <button key={c} className={`color-swatch ${activeChat?.color === c ? 'selected' : ''}`} style={{ backgroundColor: c }} onClick={() => { updateChat(activeChat.id, activeCategory.id, { color: c }); setColorPickerOpen(false); }} />)}<label className="color-swatch-custom"><input type="color" value={activeChat?.color ?? customColor} onChange={(e) => { setCustomColor(e.target.value); updateChat(activeChat!.id, activeCategory!.id, { color: e.target.value }); }} /><Palette size={14} /></label></div>}
              <div className="subtopic-input"><input value={subChatDraft} onChange={(e) => setSubChatDraft(e.target.value)} onBlur={createSubChat} placeholder="z. B. Projekt, Rezept oder Idee" /><button onClick={createSubChat}><Sparkles size={20} /></button></div>

              <div className="note-heading"><span className="section-label">03 DEINE NOTIZEN</span><span className="note-count">{sortedNotes.length} {sortedNotes.length === 1 ? 'Eintrag' : 'Einträge'}{noteLimit !== Infinity && <span className="note-limit-hint"> · {totalNoteCount}/{noteLimit}</span>}</span></div>

              {!activeNote ? <>
                <button className="new-note-btn" onClick={createNote} disabled={noteLimitReached}><Plus size={18} /> {noteLimitReached ? 'Notiz-Limit erreicht – Abo erweitern' : 'Neue Notiz erstellen'}</button>
                {sortedNotes.length === 0 ? <div className="note-empty"><FileText size={28} /><p>Noch keine Notizen in diesem Unterthema. Klicke oben, um deine erste Notiz zu schreiben.</p></div>
                : <div className="note-list">{sortedNotes.map((n) => <div className="note-card" key={n.id} style={n.color ? { background: `${n.color}22`, border: `2px solid var(--paper)`, boxShadow: `0 0 0 1px ${n.color}44` } : undefined} onClick={() => setActiveNoteId(n.id)}>
                  {n.color && <span className="note-color-bar" style={{ backgroundColor: n.color }} />}
                  <div className={`note-card-body ${n.color ? 'note-card-body-colored' : ''}`}>
                    <div className="note-card-meta"><Clock size={11} /><span>{fmtDate(n.createdAt)}</span>{n.attachments?.length ? <><Paperclip size={11} /><span>{n.attachments.length}</span></> : null}{n.factCheckStatus === 'done' && (n.sources?.length ? <CircleAlert size={11} className="fact-warn" /> : <CheckCircle2 size={11} className="fact-ok" />)}</div>
                    <p className="note-card-preview">{n.content || t(settings.uiLang, 'noContent')}</p>
                  </div>
                  <button className="note-card-menu" onClick={(e) => { e.stopPropagation(); setManageMenu({ type: 'note', categoryId: activeCategory.id, chatId: activeChat.id, noteId: n.id, x: e.clientX, y: e.clientY }); }}><MoreHorizontal size={15} /></button>
                </div>)}</div>}
              </> : <>
                <div className="note-editor-bar"><button className="back-to-list" onClick={() => { if (isDirtyRef.current) void saveToCloud(); setActiveNoteId(null); }}><ArrowLeft size={16} /> {t(settings.uiLang, 'back')}</button><div className="note-editor-meta"><Clock size={12} /><span>{fmtDate(activeNote.createdAt)}</span></div><button className="note-card-menu" onClick={(e) => { e.stopPropagation(); setManageMenu({ type: 'note', categoryId: activeCategory.id, chatId: activeChat.id, noteId: activeNote.id, x: e.clientX, y: e.clientY }); }}><MoreHorizontal size={16} /></button></div>
                <div className="note-field">
                  <textarea value={noteContent} onChange={(e) => updateActiveNoteContent(e.target.value)} onBlur={() => { if (isDirtyRef.current) void saveToCloud(); }} placeholder={t(settings.uiLang, 'welcome')} dir="ltr" />
                  <div className="note-toolbar"><div className="voice-controls">{!recording ? <button className="speak-button" onClick={toggleRecording}><span className="mic-ring"><Mic size={16} /></span><span>{t(settings.uiLang, 'speak')}</span></button> : <><button className={`speak-button ${recordingPaused ? 'paused' : 'recording'}`} onClick={pauseRecording}><span className="mic-ring">{recordingPaused ? <Mic size={16} /> : <Pause size={14} />}</span><span>{recordingPaused ? t(settings.uiLang, 'resume') : t(settings.uiLang, 'pause')}</span></button><button className="speak-button stop-btn" onClick={stopRecording}><span className="mic-ring stop"><Square size={12} /></span><span>{t(settings.uiLang, 'stop')}</span></button></>}</div><span className="character-count">{noteContent.length} {t(settings.uiLang, 'charCount')}</span></div>
                </div>
                <div className="attachment-box" onClick={() => fileInputRef.current?.click()}><input ref={fileInputRef} type="file" hidden accept="image/*,video/*,.pdf,.doc,.docx,.txt" multiple onChange={(e) => void handleFileUpload(e.target.files)} /><div className="attachment-icon"><Paperclip size={19} /></div><div><strong>{t(settings.uiLang, 'attachFile')}</strong><span>{t(settings.uiLang, 'mediaHint')} · {noteAttachments.length} {t(settings.uiLang, noteAttachments.length === 1 ? 'attachmentSingular' : 'attachmentPlural')}</span></div>{uploading ? <LoaderCircle size={17} className="upload-icon spin" /> : <Upload size={17} className="upload-icon" />}</div>
                {noteAttachments.length > 0 && <div className="attachment-previews">{noteAttachments.map((att) => <div className="attachment-thumb" key={att.id}>{att.type.startsWith('video/') ? <><video src={att.dataUrl ?? loadedAtt[att.id] ?? ''} poster={att.poster} controls preload="metadata" className="video-thumb" />{att.duration && <span className="video-duration">{att.duration.toFixed(0)}s</span>}</> : att.type.startsWith('image/') ? <img src={att.dataUrl ?? loadedAtt[att.id] ?? ''} alt={att.name} /> : <div className="file-thumb"><Paperclip size={18} /></div>}<button className="thumb-remove" onClick={(e) => { e.stopPropagation(); removeAttachment(att.id); }}><X size={12} /></button><span className="thumb-name">{att.name}</span></div>)}</div>}
                <div className="action-grid"><button className="secondary-button" onClick={runFactCheck}><Search size={17} /> {t(settings.uiLang, 'factCheck')}</button><button className="secondary-button" onClick={() => void copyNoteText()}><Clipboard size={17} /> {t(settings.uiLang, 'copy')}</button><button className="secondary-button" onClick={() => setOcrDialog(true)}><ScanText size={17} /> {t(settings.uiLang, 'handwriting')}</button></div>
                {factCheckStatus !== 'idle' && <div className={`fact-status ${factCheckStatus}`} aria-live="polite">{factCheckStatus === 'checking' ? <><span className="spinner" /> Fachdatenbank-Abgleich aktiv …</> : activeFindings.length ? <><CircleAlert size={18} /> {activeFindings.length} {activeFindings.length === 1 ? 'Hinweis' : 'Hinweise'} gefunden – klicke auf die markierten Stellen</> : <><CheckCircle2 size={18} /> Alle Fakten plausibel – kein Handlungsbedarf</>}</div>}
                {factCheckStatus === 'done' && activeFindings.length > 0 && <div className="fact-review"><div className="fact-review-hint">Markierte Stellen im Text – klicke auf eine Markierung zum Korrigieren:</div><div className="fact-highlighted-text">{buildHighlightedContent().map((seg, i) => seg.fact ? <span key={i} className="fact-highlight" onClick={() => { setFactModal(seg.fact ?? null); setFactModalIndex(activeFindings.indexOf(seg.fact!)); setShowManualEdit(false); setManualEditValue(''); }}>{seg.text}<CircleAlert size={10} className="fact-highlight-icon" /></span> : <span key={i}>{seg.text}</span>)}</div><div className="fact-findings-list">{activeFindings.map((f, i) => <div className="fact-card" key={i} onClick={() => { setFactModal(f); setFactModalIndex(i); setShowManualEdit(false); setManualEditValue(''); }}><span className="fact-index">0{i + 1}</span><div><strong>{f.claim}</strong><p>{f.correction}</p><div className="fact-source"><small>Quelle: {f.source}</small>{f.url && <a href={f.url} target="_blank" rel="noopener noreferrer" className="source-link" onClick={(e) => e.stopPropagation()}><ExternalLink size={12} /> öffnen</a>}</div></div></div>)}</div></div>}
              </>}
            </section>
            <div className="save-row">
              <button className="save-button" onClick={() => void saveToCloud()}>{t(settings.uiLang, 'saveBtn')} <ArrowLeft size={17} className="flip-x" /></button>
              <div className={`save-status-pill ${saveStatus}`}>
                {saveStatus === 'saving' && <span className="spinner" />}
                {saveStatus === 'saved' && <CheckCircle2 size={14} />}
                {saveStatus === 'failed' && <CircleAlert size={14} />}
                {saveStatus === 'offline' && <Archive size={14} />}
                <span>{saveStatusText}</span>
                {saveStatus === 'failed' && <button className="retry-btn" onClick={() => void saveToCloud()}><RefreshCw size={12} /> Erneut versuchen</button>}
              </div>
            </div>
          </>}
          <footer><span>{t(settings.uiLang, 'footer')}</span><span className="footer-links">{actionNotice || (saveStatus === 'saving' ? <><LoaderCircle size={14} className="spin" /> Wird gespeichert</> : <><Store size={14} /> {saveStatusText}</>)}</span></footer>
        </main>
      </div>

      {chatOpen && <div className="chat-bubble" onClick={(e) => e.stopPropagation()}>
        <div className="chat-bubble-head"><div className="chat-bubble-title"><MessageCircle size={18} /><span>{t(settings.uiLang, 'chatTitle')}</span></div><button className="icon-button" onClick={() => setChatOpen(false)}><X size={18} /></button></div>
        <div className="chat-messages" ref={chatScrollRef}>
          {chatMessages.length === 0 && !chatThinking && <div className="chat-empty"><MessageCircle size={28} /><p>{t(settings.uiLang, 'chatEmpty')}</p></div>}
          {chatMessages.map((msg) => <div className={`chat-msg ${msg.role}`} key={msg.id}><div className="chat-msg-text">{msg.text.split('\n').map((line, i) => <span key={i}>{line}<br /></span>)}</div>{msg.sources?.length ? <div className="chat-sources">{msg.sources.map((s, i) => <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="source-chip"><LinkIcon size={11} /> {s.title} <ExternalLink size={10} /></a>)}</div> : null}{msg.role === 'assistant' && activeNote && <button className="chat-adopt-btn" onClick={() => adoptChatToNote(msg.text)}><PenLine size={12} /> {t(settings.uiLang, 'adoptToNote')}</button>}</div>)}
          {chatThinking && <div className="chat-msg assistant"><div className="chat-msg-text chat-thinking"><span className="spinner" /> {t(settings.uiLang, 'thinking')}</div></div>}
        </div>
        <div className="chat-input-row"><textarea value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }} placeholder={t(settings.uiLang, 'chatPlaceholder')} rows={1} dir="ltr" /><button className={`chat-mic ${chatRecording ? 'recording' : ''}`} onClick={toggleChatRecording} aria-label="Sprechen"><Mic size={18} /></button><button className="chat-send" onClick={sendChatMessage} disabled={!chatInput.trim()}><Send size={18} /></button></div>
      </div>}

      {manageMenu && <div className="manage-menu" style={{ top: manageMenu.y, left: Math.min(manageMenu.x, window.innerWidth - 180) }} onClick={(e) => e.stopPropagation()}>
        {manageMenu.type === 'category' && <>
          <button onClick={() => { const cat = workspace.categories.find((c) => c.id === manageMenu.categoryId); setRenameTarget({ type: 'category', categoryId: manageMenu.categoryId, currentName: cat?.title ?? '' }); setRenameValue(cat?.title ?? ''); setManageMenu(null); }}><PenLine size={14} /> {t(settings.uiLang, 'rename')}</button>
          <button onClick={() => setDeleteConfirm({ type: 'category', id: manageMenu.categoryId })}><Trash2 size={14} /> {t(settings.uiLang, 'deleteAction')}</button>
        </>}
        {manageMenu.type === 'chat' && manageMenu.chatId && <>
          <button onClick={() => { const cat = workspace.categories.find((c) => c.id === manageMenu.categoryId); const ch = cat?.chats.find((c2) => c2.id === manageMenu.chatId); setRenameTarget({ type: 'chat', categoryId: manageMenu.categoryId, chatId: manageMenu.chatId, currentName: ch?.title ?? '' }); setRenameValue(ch?.title ?? ''); setManageMenu(null); }}><PenLine size={14} /> {t(settings.uiLang, 'rename')}</button>
          <button onClick={() => setMoveDialog({ chatId: manageMenu.chatId!, fromCategoryId: manageMenu.categoryId })}><FolderInput size={14} /> {t(settings.uiLang, 'moveAction')}</button>
          <button onClick={() => copyChat(manageMenu.categoryId, manageMenu.chatId!)}><Copy size={14} /> {t(settings.uiLang, 'copyAction')}</button>
          <button onClick={() => setDeleteConfirm({ type: 'chat', id: manageMenu.chatId!, categoryId: manageMenu.categoryId })}><Trash2 size={14} /> {t(settings.uiLang, 'deleteAction')}</button>
        </>}
        {manageMenu.type === 'note' && manageMenu.noteId && <>
          <button onClick={() => { duplicateNote(manageMenu.noteId!); }}><Copy size={14} /> {t(settings.uiLang, 'duplicate')}</button>
          <button onClick={() => setBookletDialog(true)}><BookOpen size={14} /> {t(settings.uiLang, 'booklet')}</button>
          <button onClick={() => setDeleteConfirm({ type: 'note', id: manageMenu.noteId!, categoryId: manageMenu.categoryId, chatId: manageMenu.chatId })}><Trash2 size={14} /> {t(settings.uiLang, 'deleteAction')}</button>
        </>}
      </div>}

      {deleteConfirm && <div className="modal-backdrop" onClick={() => setDeleteConfirm(null)}><div className="category-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={() => setDeleteConfirm(null)}><X size={18} /></button>
        <span className="section-label">{t(settings.uiLang, 'securityQuestion')}</span>
        <h2>{t(settings.uiLang, 'deleteTitle')}</h2>
        <p>{deleteConfirm.type === 'note' ? t(settings.uiLang, 'deleteNote') : deleteConfirm.type === 'chat' ? t(settings.uiLang, 'deleteChat') : t(settings.uiLang, 'deleteCategory')}</p>
        <div className="confirm-row"><button className="cancel-btn" onClick={() => setDeleteConfirm(null)}>{t(settings.uiLang, 'cancel')}</button><button className="danger-btn" onClick={() => { if (deleteConfirm.type === 'note') deleteNote(deleteConfirm.id); else if (deleteConfirm.type === 'chat') deleteChat(deleteConfirm.categoryId!, deleteConfirm.id); else deleteCategory(deleteConfirm.id); }}><Trash2 size={15} /> {t(settings.uiLang, 'deleteForever')}</button></div>
      </div></div>}

      {moveDialog && <div className="modal-backdrop" onClick={() => setMoveDialog(null)}><div className="category-modal" onClick={(e) => e.stopPropagation()}><button className="modal-close" onClick={() => setMoveDialog(null)}><X size={18} /></button><span className="section-label">{t(settings.uiLang, 'moveLabel')}</span><h2>{t(settings.uiLang, 'moveTitle')}</h2><div className="move-list">{workspace.categories.filter((c) => c.id !== moveDialog.fromCategoryId).map((c) => <button key={c.id} className="move-option" onClick={() => moveChat(moveDialog.chatId, moveDialog.fromCategoryId, c.id)}><span className="category-icon" style={{ backgroundColor: `${c.color}22`, color: c.color }}>{c.emoji}</span><span>{c.title}</span></button>)}</div></div></div>}

      {bookletDialog && <div className="modal-backdrop" onClick={() => setBookletDialog(false)}><div className="booklet-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={() => setBookletDialog(false)}><X size={18} /></button>
        <span className="section-label">{t(settings.uiLang, 'bookletLabel')}</span>
        <h2>{t(settings.uiLang, 'bookletTitle')}</h2>
        <div className="booklet-options">
          <div className="booklet-option-group"><label>Layout</label><div className="option-pills">{['Klassisch', 'Modern', 'Tagebuch'].map((l) => <button key={l} className={bookletOptions.layout === l ? 'active' : ''} onClick={() => setBookletOptions((o) => ({ ...o, layout: l }))}>{l}</button>)}</div></div>
          <div className="booklet-option-group"><label>Tonalität</label><div className="option-pills">{['Persönlich', 'Sachlich', 'Poetisch'].map((t) => <button key={t} className={bookletOptions.tonalitaet === t ? 'active' : ''} onClick={() => setBookletOptions((o) => ({ ...o, tonalitaet: t }))}>{t}</button>)}</div></div>
          <div className="booklet-option-group"><label>Kalligrafische Initialen</label><button className={bookletOptions.initialen ? 'active' : ''} onClick={() => setBookletOptions((o) => ({ ...o, initialen: !o.initialen }))}>{bookletOptions.initialen ? 'Ein' : 'Aus'}</button></div>
        </div>
        <pre className="booklet-preview">{generateBooklet()}</pre>
        <button className="primary-button full-width" onClick={copyBooklet}><Clipboard size={16} /> {t(settings.uiLang, 'bookletCopied')}</button>
        {!isPremium && <p className="booklet-freemium-hint">{t(settings.uiLang, 'bookletPreviewHint')}</p>}
      </div></div>}

      {crashDialog && <div className="modal-backdrop" onClick={() => setCrashDialog(false)}><div className="category-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={() => setCrashDialog(false)}><X size={18} /></button>
        <span className="section-label">ABSTURZ-WIEDERHERSTELLUNG</span>
        <h2>{t(settings.uiLang, 'crashTitle')}</h2>
        <p>{t(settings.uiLang, 'crashDesc')}</p>
        <div className="confirm-row"><button className="cancel-btn" onClick={() => { if (cloudStateRef.current) { setWorkspace(cloudStateRef.current); localStorage.setItem(LAST_SAVE_KEY, Date.now().toString()); cloudStateRef.current = null; } setCrashDialog(false); }}>{t(settings.uiLang, 'keepCloud')}</button><button className="primary-button" onClick={() => { localStorage.setItem(LAST_SAVE_KEY, Date.now().toString()); setSaveStatus('saved'); setCrashDialog(false); void saveToCloud(); }}>{t(settings.uiLang, 'keepLocal')}</button></div>
      </div></div>}

      {showWelcome && <div className="modal-backdrop" onClick={() => setShowWelcome(false)}><div className="welcome-modal" onClick={(e) => e.stopPropagation()}><button className="modal-close" onClick={() => setShowWelcome(false)}><X size={18} /></button><div className="modal-sun"><Sun size={28} /></div><span className="eyebrow">{t(settings.uiLang, 'welcomeBack')}</span><h2>{workspace.name.trim() ? `${workspace.name.trim()}s Universum` : t(settings.uiLang, 'welcomeModalTitle')}</h2><p>{t(settings.uiLang, 'welcomeModalDesc')}</p><button className="primary-button" onClick={() => setShowWelcome(false)}>{t(settings.uiLang, 'continueBtn')} <ArrowLeft size={16} className="flip-x" /></button></div></div>}

      {categoryDialog && <div className="modal-backdrop" onClick={() => setCategoryDialog(false)}><div className="category-modal" onClick={(e) => e.stopPropagation()}><button className="modal-close" onClick={() => setCategoryDialog(false)}><X size={18} /></button><span className="section-label">{t(settings.uiLang, 'newArea')}</span><h2>{t(settings.uiLang, 'areaPrompt')}</h2><input autoFocus value={newCategory.title} onChange={(e) => setNewCategory((c) => ({ ...c, title: e.target.value }))} placeholder={t(settings.uiLang, 'areaPlaceholder')} /><div className="picker-label"><span>Symbol</span><button onClick={() => { setEmojiPicker((v) => !v); setEmojiSearch(''); }}>{newCategory.emoji} <ChevronDown size={14} /></button></div>{emojiPicker && <div className="emoji-picker-expanded"><input className="emoji-search" autoFocus placeholder="Emoji suchen …" value={emojiSearch} onChange={(e) => setEmojiSearch(e.target.value)} /><div className="emoji-grid">{emojiOptions.filter((em) => { if (!emojiSearch.trim()) return true; const q = emojiSearch.toLowerCase().trim(); const kws = emojiKeywords[em] ?? []; return kws.some((k) => k.includes(q) || q.includes(k)); }).map((em) => <button key={em} onClick={() => { setNewCategory((c) => ({ ...c, emoji: em })); setEmojiPicker(false); }}>{em}</button>)}</div><input className="emoji-custom-input" placeholder="Eigenes Emoji eintippen" onChange={(e) => { const v = e.target.value; if (v) { const chars = Array.from(v); setNewCategory((c) => ({ ...c, emoji: chars[chars.length - 1] || c.emoji })); } }} /></div>}<div className="picker-label"><span>Akzentfarbe</span><button onClick={() => setShowCustomColor((v) => !v)}>Freie Farbe <ChevronDown size={14} /></button></div><div className="color-picker-row">{colorOptions.map((c) => <button key={c} className={`color-swatch ${newCategory.color === c ? 'selected' : ''}`} style={{ backgroundColor: c }} onClick={() => setNewCategory((cur) => ({ ...cur, color: c }))} />)}</div>{showCustomColor && <div className="custom-color-picker"><label>Freie Farbauswahl</label><input type="color" value={customColor} onChange={(e) => { setCustomColor(e.target.value); setNewCategory((cur) => ({ ...cur, color: e.target.value })); }} /></div>}<button className="primary-button full-width" onClick={createCategory}>Bereich anlegen <Plus size={16} /></button></div></div>}

      {settingsOpen && <div className="modal-backdrop" onClick={() => setSettingsOpen(false)}><div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={() => setSettingsOpen(false)}><X size={18} /></button>
        <div className="settings-layout">
          <div className="settings-sidebar">
            <span className="section-label">{t(settings.uiLang, 'settings')}</span>
            <h2>{t(settings.uiLang, 'settingsTitle')}</h2>
            <nav className="settings-nav">
              <button className={settingsTab === 'ki' ? 'active' : ''} onClick={() => setSettingsTab('ki')}><Sparkles size={16} /> {t(settings.uiLang, 'tabKi')}</button>
              <button className={settingsTab === 'editor' ? 'active' : ''} onClick={() => setSettingsTab('editor')}><PenLine size={16} /> {t(settings.uiLang, 'tabEditor')}</button>
              <button className={settingsTab === 'sprache' ? 'active' : ''} onClick={() => setSettingsTab('sprache')}><Globe size={16} /> {t(settings.uiLang, 'tabLang')}</button>
              <button className={settingsTab === 'sicherheit' ? 'active' : ''} onClick={() => setSettingsTab('sicherheit')}><Shield size={16} /> {t(settings.uiLang, 'tabSecurity')}</button>
              <button className={settingsTab === 'abo' ? 'active' : ''} onClick={() => setSettingsTab('abo')}><CreditCard size={16} /> {t(settings.uiLang, 'tabAbo')}</button>
            </nav>
          </div>
          <div className="settings-content">
            {settingsTab === 'ki' && <>
              <h3>{t(settings.uiLang, 'kiArt')}</h3>
              <p className="settings-hint">{t(settings.uiLang, 'kiArtHint')}</p>
              <div className="settings-group">
                <label className="settings-label">{t(settings.uiLang, 'modelSelect')}</label>
                <div className="model-picker">
                  <button className={`model-card ${settings.aiModel === 'standard' ? 'active' : ''}`} onClick={() => updateSettings({ aiModel: 'standard' })}>
                    <Shield size={18} />
                    <div className="model-card-body"><strong>{t(settings.uiLang, 'modelStandard')}</strong><span>{t(settings.uiLang, 'modelStandardDesc')}</span></div>
                  </button>
                  <button className={`model-card ${settings.aiModel === 'companion' ? 'active' : ''}`} onClick={() => updateSettings({ aiModel: 'companion' })}>
                    <Wand2 size={18} />
                    <div className="model-card-body"><strong>{t(settings.uiLang, 'modelCompanion')}</strong><span>{t(settings.uiLang, 'modelCompanionDesc')}</span></div>
                  </button>
                  <button className={`model-card ${settings.aiModel === 'master' ? 'active' : ''}`} onClick={() => updateSettings({ aiModel: 'master' })}>
                    <Sparkles size={18} />
                    <div className="model-card-body"><strong>{t(settings.uiLang, 'modelMaster')}</strong><span>{t(settings.uiLang, 'modelMasterDesc')}</span></div>
                  </button>
                </div>
              </div>

              {settings.aiModel === 'standard' && <div className="settings-group">
                <label className="settings-label">{t(settings.uiLang, 'memorySwitch')}</label>
                <div className="settings-toggle-row"><span>{t(settings.uiLang, 'memoryOn')}</span><button className={`toggle-switch ${settings.memoryMode === 'persistent' ? 'on' : ''}`} onClick={() => updateSettings({ memoryMode: settings.memoryMode === 'persistent' ? 'isolated' : 'persistent' })}><span className="toggle-knob" /></button></div>
                <p className="settings-hint">{t(settings.uiLang, 'memoryOnHint')}</p>
              </div>}

              {settings.aiModel === 'companion' && <div className="settings-group">
                <label className="settings-label">{t(settings.uiLang, 'behaviorProfile')}</label>
                <p className="settings-hint">{t(settings.uiLang, 'behaviorProfileHint')}</p>
                <div className="behavior-profile-grid">
                  <button className={`profile-card ${settings.companionProfile === 'sarcastic' ? 'active' : ''}`} onClick={() => updateSettings({ companionProfile: 'sarcastic' })}>
                    <div className="profile-icon"><Wand2 size={18} /></div>
                    <strong>{t(settings.uiLang, 'profileSarcastic')}</strong>
                    <span>{t(settings.uiLang, 'profileSarcasticDesc')}</span>
                  </button>
                  <button className={`profile-card ${settings.companionProfile === 'humorous' ? 'active' : ''}`} onClick={() => updateSettings({ companionProfile: 'humorous' })}>
                    <div className="profile-icon"><MessageCircle size={18} /></div>
                    <strong>{t(settings.uiLang, 'profileHumorous')}</strong>
                    <span>{t(settings.uiLang, 'profileHumorousDesc')}</span>
                  </button>
                  <button className={`profile-card ${settings.companionProfile === 'strict' ? 'active' : ''}`} onClick={() => updateSettings({ companionProfile: 'strict' })}>
                    <div className="profile-icon"><ScanText size={18} /></div>
                    <strong>{t(settings.uiLang, 'profileStrict')}</strong>
                    <span>{t(settings.uiLang, 'profileStrictDesc')}</span>
                  </button>
                  <button className={`profile-card ${settings.companionProfile === 'creative' ? 'active' : ''}`} onClick={() => updateSettings({ companionProfile: 'creative' })}>
                    <div className="profile-icon"><Sprout size={18} /></div>
                    <strong>{t(settings.uiLang, 'profileCreative')}</strong>
                    <span>{t(settings.uiLang, 'profileCreativeDesc')}</span>
                  </button>
                </div>
              </div>}

              {settings.aiModel === 'master' && <div className="settings-group">
                <label className="settings-label">{t(settings.uiLang, 'masterControl')}</label>
                <div className="settings-toggle-row"><span>{t(settings.uiLang, 'masterActive')}</span><button className={`toggle-switch ${settings.masterEnabled ? 'on' : ''}`} onClick={() => updateSettings({ masterEnabled: !settings.masterEnabled })}><span className="toggle-knob" /></button></div>
                <p className="settings-hint">{settings.masterEnabled ? t(settings.uiLang, 'masterActiveHint') : t(settings.uiLang, 'masterActiveHint')}</p>
                <div className="master-style-preview">
                  <strong>{t(settings.uiLang, 'styleAnalysis')}</strong>
                  <div className="style-stat"><Sparkles size={14} /><span>{t(settings.uiLang, 'activeSamples')} {workspace.categories.flatMap((c) => c.chats.flatMap((ch) => ch.notes)).filter((n) => n.content.trim().length > 20).length}</span></div>
                  <div className="style-stat"><BookOpen size={14} /><span>{t(settings.uiLang, 'memoryModule')}: {settings.memoryMode === 'persistent' ? t(settings.uiLang, 'memoryPersistent') : t(settings.uiLang, 'memoryIsolated')}</span></div>
                </div>
              </div>}

              <div className="settings-group">
                <label className="settings-label">{t(settings.uiLang, 'memoryModule')}</label>
                <div className="memory-toggle-grid">
                  <button className={`memory-card ${settings.memoryMode === 'persistent' ? 'active' : ''}`} onClick={() => updateSettings({ memoryMode: 'persistent' })}><div className="memory-card-head"><BookOpen size={16} /> <strong>{t(settings.uiLang, 'memPersistentTitle')}</strong></div><p>{t(settings.uiLang, 'memPersistentDesc')}</p></button>
                  <button className={`memory-card ${settings.memoryMode === 'isolated' ? 'active' : ''}`} onClick={() => updateSettings({ memoryMode: 'isolated' })}><div className="memory-card-head"><Lock size={16} /> <strong>{t(settings.uiLang, 'memIsolatedTitle')}</strong></div><p>{t(settings.uiLang, 'memIsolatedDesc')}</p></button>
                </div>
              </div>
            </>}
            {settingsTab === 'editor' && <>
              <h3>{t(settings.uiLang, 'tabEditor')}</h3>
              <div className="settings-group">
                <label className="settings-label">Helligkeits- & Design-Modus</label>
                <div className="theme-picker">
                  <button className={`theme-card ${settings.theme === 'paper' ? 'active' : ''}`} onClick={() => updateSettings({ theme: 'paper' })}><div className="theme-swatch paper" /><span>{t(settings.uiLang, 'themePaper')}</span></button>
                  <button className={`theme-card ${settings.theme === 'light' ? 'active' : ''}`} onClick={() => updateSettings({ theme: 'light' })}><div className="theme-swatch light" /><span>{t(settings.uiLang, 'themeLight')}</span></button>
                  <button className={`theme-card ${settings.theme === 'dark' ? 'active' : ''}`} onClick={() => updateSettings({ theme: 'dark' })}><div className="theme-swatch dark" /><span>{t(settings.uiLang, 'themeDark')}</span></button>
                </div>
                <p className="settings-hint">{t(settings.uiLang, 'themeHint')}</p>
              </div>
              <div className="settings-group">
                <label className="settings-label">{t(settings.uiLang, 'fontBody')}</label>
                <div className="option-pills">
                  <button className={settings.bodyFont === 'nunito' ? 'active' : ''} onClick={() => updateSettings({ bodyFont: 'nunito' })} style={{ fontFamily: "'Nunito', sans-serif" }}>Nunito</button>
                  <button className={settings.bodyFont === 'lora' ? 'active' : ''} onClick={() => updateSettings({ bodyFont: 'lora' })} style={{ fontFamily: "'Lora', serif" }}>Lora Serif</button>
                  <button className={settings.bodyFont === 'inter' ? 'active' : ''} onClick={() => updateSettings({ bodyFont: 'inter' })} style={{ fontFamily: "'Inter', sans-serif" }}>Inter</button>
                </div>
                <p className="settings-hint">{t(settings.uiLang, 'fontHint')}</p>
              </div>
              <div className="settings-group">
                <label className="settings-label">{t(settings.uiLang, 'fontSize')}</label>
                <div className="font-size-control"><input type="range" min={12} max={22} value={settings.fontSize} onChange={(e) => updateSettings({ fontSize: parseInt(e.target.value) })} className="font-slider" /><span className="font-size-value" style={{ fontSize: settings.fontSize }}>{settings.fontSize}px</span></div>
                <div className="font-preview" style={{ fontSize: settings.fontSize, lineHeight: 1.6 }}>{t(settings.uiLang, 'fontPreview')}</div>
              </div>
              <div className="settings-group">
                <label className="settings-label">{t(settings.uiLang, 'mediaMgmt')}</label>
                <div className="media-stats"><div className="media-stat"><Hash size={14} /><span>{cacheStats.items} {t(settings.uiLang, 'mediaElements')}</span></div><div className="media-stat"><Clock size={14} /><span>{cacheStats.sizeKb > 1024 ? `${(cacheStats.sizeKb / 1024).toFixed(1)} MB` : `${cacheStats.sizeKb} KB`} {t(settings.uiLang, 'stored')}</span></div></div>
                <p className="settings-hint">{t(settings.uiLang, 'mediaHint')}. Automatische Komprimierung aktiv.</p>
                {clearCacheConfirm ? <><span style={{ fontSize: '13px', color: 'var(--error)' }}>{t(settings.uiLang, 'removed')}?</span><button className="settings-action-btn danger" onClick={clearCache}>Ja, entfernen</button><button className="settings-action-btn" onClick={() => setClearCacheConfirm(false)}>{t(settings.uiLang, 'cancel')}</button></> : <button className="settings-action-btn" onClick={() => setClearCacheConfirm(true)}>Cache leeren</button>}
              </div>
              <div className="settings-group">
                <label className="settings-label">{t(settings.uiLang, 'autoSave')}</label>
                <div className="settings-row"><span>{t(settings.uiLang, 'autoSaveHint')}</span><span className="status-badge active">{t(settings.uiLang, 'active')}</span></div>
              </div>
            </>}
            {settingsTab === 'sprache' && <>
              <h3>{t(settings.uiLang, 'tabLang')}</h3>
              <div className="settings-group">
                <label className="settings-label">{t(settings.uiLang, 'editorLang')}</label>
                <div className="option-pills"><button className={settings.language === 'English' ? 'active' : ''} onClick={() => { updateSettings({ language: 'English', uiLang: 'en' }); setLanguage('English'); }}>English</button><button className={settings.language === 'Hochdeutsch' ? 'active' : ''} onClick={() => { updateSettings({ language: 'Hochdeutsch', uiLang: 'de' }); setLanguage('Hochdeutsch'); }}>Hochdeutsch</button><button className={settings.language === 'Schweizerdeutsch' ? 'active' : ''} onClick={() => { updateSettings({ language: 'Schweizerdeutsch', uiLang: 'de-ch' }); setLanguage('Schweizerdeutsch'); }}>Schweizerdeutsch</button><button className={settings.language === 'Français' ? 'active' : ''} onClick={() => { updateSettings({ language: 'Français', uiLang: 'fr' }); setLanguage('Français'); }}>Français</button><button className={settings.language === 'Italiano' ? 'active' : ''} onClick={() => { updateSettings({ language: 'Italiano', uiLang: 'it' }); setLanguage('Italiano'); }}>Italiano</button><button className={settings.language === 'Español' ? 'active' : ''} onClick={() => { updateSettings({ language: 'Español', uiLang: 'es' }); setLanguage('Español'); }}>Español</button></div>
                <p className="settings-hint">{t(settings.uiLang, 'editorLangHint')}</p>
              </div>
              <div className="settings-group">
                <label className="settings-label">{t(settings.uiLang, 'currency')}</label>
                <div className="option-pills"><button className={settings.currency === 'CHF' ? 'active' : ''} onClick={() => updateSettings({ currency: 'CHF' })}>CHF</button><button className={settings.currency === 'EUR' ? 'active' : ''} onClick={() => updateSettings({ currency: 'EUR' })}>EUR</button><button className={settings.currency === 'USD' ? 'active' : ''} onClick={() => updateSettings({ currency: 'USD' })}>USD</button></div>
              </div>
              <div className="settings-group">
                <label className="settings-label">{t(settings.uiLang, 'categoryMgmt')}</label>
                <p className="settings-hint">{workspace.categories.length} {t(settings.uiLang, 'categoryMgmtHint')}</p>
                <div className="category-list-settings">{workspace.categories.map((c) => <div key={c.id} className="category-list-item"><span className="cat-emoji">{c.emoji}</span><span className="cat-name">{c.title}</span><span className="cat-dot" style={{ backgroundColor: c.color }} /></div>)}</div>
              </div>
            </>}
            {settingsTab === 'sicherheit' && <>
              <h3>{t(settings.uiLang, 'tabSecurity')}</h3>
              <div className="settings-group">
                <label className="settings-label">App-Schutz</label>
                <div className="settings-row"><span>{t(settings.uiLang, 'currentProtection')}: <strong>{settings.protection === 'none' ? t(settings.uiLang, 'noProtection') : settings.protection === 'pin' ? t(settings.uiLang, 'pinCode') : t(settings.uiLang, 'password')}</strong></span></div>
                <div className="protection-options">
                  <button className={`protection-btn ${settings.protection === 'none' ? 'active' : ''}`} onClick={() => updateSettings({ protection: 'none', protectionValue: '', protectionSalt: '', protectionHash: '' })}>Kein Schutz</button>
                  <button className={`protection-btn ${settings.protection === 'pin' ? 'active' : ''}`} onClick={setProtectionPin}>PIN-Code</button>
                  <button className={`protection-btn ${settings.protection === 'password' ? 'active' : ''}`} onClick={setProtectionPassword}>Passwort</button>
                </div>
                <p className="settings-hint">{t(settings.uiLang, 'protectionHint')}</p>
              </div>
              <div className="settings-group">
                <label className="settings-label">Biometrische Absicherung</label>
                <div className="settings-toggle-row"><span>{t(settings.uiLang, 'biometricSoon')}</span><button className="toggle-switch" disabled><span className="toggle-knob" /></button></div>
                <p className="settings-hint">{t(settings.uiLang, 'biometricHint')}</p>
              </div>
              {settings.protection !== 'none' && <div className="settings-group">
                <label className="settings-label">Passwort ändern</label>
                <button className="settings-action-btn" onClick={changeProtection}>{t(settings.uiLang, 'changeProtection')}</button>
              </div>}
              <div className="settings-group">
                <label className="settings-label">{t(settings.uiLang, 'accountLogin')}</label>
                {settings.userEmail ? (
                  <>
                    <div className="settings-row"><span>{t(settings.uiLang, 'signedInAs')} <strong>{settings.userEmail}</strong></span><span className="status-badge active">Cloud</span></div>
                    <button className="settings-action-btn cancel" onClick={() => void handleSignOut()}><LogOut size={14} /> {t(settings.uiLang, 'signOut')}</button>
                    <p className="settings-hint">{t(settings.uiLang, 'signOutHint')}</p>
                  </>
                ) : (
                  <>
                    <div className="settings-row"><span>{t(settings.uiLang, 'notSignedIn')}</span></div>
                    <div className="account-buttons">
                      <button className="account-btn" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}><Globe size={16} /> {t(settings.uiLang, 'googleSoon')}</button>
                      <button className="account-btn" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}><Store size={16} /> {t(settings.uiLang, 'appleSoon')}</button>
                    </div>
                    <p className="settings-hint">{t(settings.uiLang, 'noAccountHint')}</p>
                  </>
                )}
              </div>
              <div className="settings-group">
                <label className="settings-label">{t(settings.uiLang, 'dataPrivacy')}</label>
                <div className="backup-buttons">
                  <button className="settings-action-btn" onClick={exportBackup}><Upload size={14} /> {t(settings.uiLang, 'backupExport')}</button>
                  <button className="settings-action-btn danger" onClick={factoryReset}><Trash2 size={14} /> {t(settings.uiLang, 'factoryReset')}</button>
                </div>
                <p className="settings-hint">{t(settings.uiLang, 'backupHint')}</p>
              </div>
              <div className="settings-group">
                <label className="settings-label">{t(settings.uiLang, 'universeName')}</label>
                <input className="settings-input" value={workspace.name} onChange={(e) => setWorkspace((c) => ({ ...c, name: e.target.value }))} />
              </div>
            </>}
            {settingsTab === 'abo' && <>
              <h3>{t(settings.uiLang, 'aboTitle')}</h3>
              <div className="settings-group">
                <label className="settings-label">{t(settings.uiLang, 'tierStatus')}</label>
                <div className="tier-status-box"><Sparkles size={16} /><div><strong>{tierInfo[effectiveTier].name}</strong>{trialActive ? ' (Gratismonat)' : ''}<p>{tierInfo[effectiveTier].desc}</p></div></div>
                <button className="settings-action-btn" onClick={() => { setSettingsOpen(false); setBookletDialog(true); }}>{t(settings.uiLang, 'toStore')}</button>
              </div>
              {trialActive && <div className="trial-banner"><Sparkles size={16} /><div><strong>30-Tage Gratismonat aktiv</strong><span>Alle Premium-Funktionen offen bis {trialEndDate ? trialEndDate.toLocaleDateString('de-DE') : 'bald'}</span></div></div>}
              <div className="settings-group">
                <label className="settings-label">{t(settings.uiLang, 'billingInterval')}</label>
                <div className="option-pills"><button className={settings.billingInterval === 'monthly' ? 'active' : ''} onClick={() => updateSettings({ billingInterval: 'monthly' })}>{t(settings.uiLang, 'monthly')}</button><button className={settings.billingInterval === 'yearly' ? 'active' : ''} onClick={() => updateSettings({ billingInterval: 'yearly' })}>{t(settings.uiLang, 'yearly')} <span className="save-badge">{t(settings.uiLang, 'saveBadge')}</span></button></div>
              </div>
              <div className="tier-grid">
                {(['free', 'booklet-flat', 'smart-ki', 'komplett'] as SubscriptionTier[]).map((tier) => <div key={tier} className={`tier-card ${effectiveTier === tier ? 'selected' : ''} ${tier === 'komplett' ? 'recommended' : ''}`} onClick={() => selectTier(tier)}>
                  {tier === 'komplett' && <span className="tier-badge">Empfehlung</span>}
                  <div className="tier-head"><strong>{tierInfo[tier].name}</strong><span className="tier-price">{formatPrice(tierInfo[tier].price[settings.billingInterval])}{tierInfo[tier].price[settings.billingInterval] > 0 ? ` / ${settings.billingInterval === 'monthly' ? 'Monat' : 'Jahr'}` : ''}</span></div>
                  <p className="tier-desc">{tierInfo[tier].desc}</p>
                  <ul className="tier-features">{tierInfo[tier].features.map((f, i) => <li key={i}><CheckCircle2 size={13} /> {f}</li>)}</ul>
                  {effectiveTier === tier && <div className="tier-active"><CheckCircle2 size={14} /> Aktuell aktiv</div>}
                </div>)}
              </div>
              <div className="settings-group">
                <label className="settings-label">Status & Kündigung</label>
                <p className="settings-hint">Aktives Abo: <strong>{tierInfo[effectiveTier].name}</strong>{trialActive ? ' (Gratismonat)' : ''} · Intervall: {settings.billingInterval === 'monthly' ? 'monatlich' : 'jährlich'}</p>
                {effectiveTier !== 'free' && !trialActive && <button className="settings-action-btn cancel" onClick={() => selectTier('free')}>Abo kündigen</button>}
              </div>
              <div className="payment-notice"><CreditCard size={14} /><span>Demo-App: Alle Funktionen sind frei nutzbar. Käufe sind nicht möglich.</span></div>
              <button className="settings-action-btn reset-btn" onClick={resetTestState}><RefreshCw size={14} /> Gratismonat neu starten</button>
              <div className="settings-group">
                <label className="settings-label">Hilfe, Feedback & Info</label>
                <div className="help-box">
                  <p><strong>Universum Notes</strong> v1.0.0 · Build 2026.09</p>
                  <p>Kurze Anleitung: Erstelle Bereiche, füge Unterthemen hinzu und schreibe Notizen. Nutze den Quick-Chat für schnelle Fragen an die KI.</p>
                  <button className="settings-action-btn" onClick={() => setShowFeedback(true)}>Feedback senden</button>
                </div>
              </div>
            </>}
          </div>
        </div>
      </div></div>}

      {showFeedback && <div className="modal-backdrop" onClick={() => setShowFeedback(false)}><div className="category-modal" onClick={(e) => e.stopPropagation()}><button className="modal-close" onClick={() => setShowFeedback(false)}><X size={18} /></button><span className="section-label">FEEDBACK</span><h2>Feedback senden</h2><textarea autoFocus rows={5} placeholder="Was gefällt dir? Was könnte besser sein?" style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--line)', fontSize: '14px', fontFamily: 'inherit', resize: 'none', outline: 'none' }} /><div className="confirm-row"><button className="cancel-btn" onClick={() => setShowFeedback(false)}>Abbrechen</button><button className="primary-button" onClick={() => { setShowFeedback(false); setActionNotice('Feedback gesendet – danke!'); }}>Senden</button></div></div></div>}

      {factModal && <div className="modal-backdrop" onClick={() => setFactModal(null)}><div className="fact-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={() => setFactModal(null)}><X size={18} /></button>
        <span className="section-label">FAKTEN-CHECK · HINWEIS {factModalIndex + 1}</span>
        <h2>Markierte Stelle überprüfen</h2>
        <div className="fact-modal-snippet"><CircleAlert size={14} /> <span>{factModal.matchedText}</span></div>
        <div className="fact-modal-claim"><strong>{factModal.claim}</strong></div>
        {!showManualEdit ? <>
          <p className="fact-modal-correction">{factModal.correction}</p>
          <div className="fact-modal-suggestion"><Sparkles size={14} /><div><span className="fact-suggestion-label">Korrekturvorschlag:</span><span className="fact-suggestion-text">{factModal.correctedText}</span></div></div>
          <div className="fact-modal-source"><small>Quelle: {factModal.source}</small>{factModal.url && <a href={factModal.url} target="_blank" rel="noopener noreferrer" className="source-link"><ExternalLink size={12} /> Quelle öffnen</a>}</div>
          <div className="fact-modal-actions">
            <button className="fact-action-btn primary" onClick={() => applyFactCorrection(factModal)}><CheckCircle2 size={15} /> Korrektur übernehmen</button>
            <button className="fact-action-btn" onClick={() => ignoreFact(factModal)}><X size={15} /> Als korrekt markieren</button>
            <button className="fact-action-btn" onClick={() => { setShowManualEdit(true); setManualEditValue(factModal.matchedText); }}><PenLine size={15} /> Manuell anpassen</button>
          </div>
        </> : <>
          <div className="fact-manual-edit"><label>Text manuell bearbeiten:</label><textarea autoFocus rows={3} value={manualEditValue} onChange={(e) => setManualEditValue(e.target.value)} /><div className="confirm-row"><button className="cancel-btn" onClick={() => setShowManualEdit(false)}>Zurück</button><button className="primary-button" onClick={applyManualEdit}>Übernehmen</button></div></div>
        </>}
      </div></div>}

      {renameTarget && <div className="modal-backdrop" onClick={() => setRenameTarget(null)}><div className="category-modal" onClick={(e) => e.stopPropagation()}><button className="modal-close" onClick={() => setRenameTarget(null)}><X size={18} /></button><span className="section-label">UMBENENNEN</span><h2>{renameTarget.type === 'category' ? 'Kategorie' : 'Unterthema'} umbenennen</h2><input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={renameOnEnter} /><div className="confirm-row"><button className="cancel-btn" onClick={() => setRenameTarget(null)}>Abbrechen</button><button className="primary-button" onClick={commitRename}>Speichern</button></div></div></div>}

      {ocrDialog && <div className="modal-backdrop" onClick={closeOcr}><div className="ocr-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={closeOcr}><X size={18} /></button>
        <span className="section-label">HANDSCHRIFT-SCAN · DEMO</span>
        <h2>Handschrift einscannen</h2>
        {!ocrImage ? <div className="ocr-upload-area" onClick={() => ocrFileRef.current?.click()}><input ref={ocrFileRef} type="file" hidden accept="image/*" onChange={(e) => void handleOcrUpload(e.target.files)} /><ScanText size={32} /><strong>Foto der Notizseite hochladen</strong><span>Demo: Beispieltext wird angezeigt</span></div> : <>
          <div className="ocr-preview"><img src={ocrImage} alt="Handschrift" /></div>
          {ocrProcessing ? <div className="ocr-processing"><LoaderCircle size={20} className="spin" /> Demo-Text wird erstellt …</div> : <>
            <p className="ocr-hint">Wähle die Abschnitte aus, die du übernehmen möchtest:</p>
            <div className="ocr-segments">{ocrSegments.map((seg) => <label key={seg.id} className={`ocr-segment ${seg.selected ? 'selected' : ''}`}><input type="checkbox" checked={seg.selected} onChange={() => setOcrSegments((s) => s.map((x) => x.id === seg.id ? { ...x, selected: !x.selected } : x))} /><span className="ocr-segment-text">{seg.text}</span></label>)}</div>
            <div className="confirm-row"><button className="cancel-btn" onClick={closeOcr}>Abbrechen</button><button className="primary-button" onClick={adoptOcrSelection} disabled={!ocrSegments.some((s) => s.selected)}>Auswahl übernehmen</button></div>
          </>}
        </>}
      </div></div>}

      {bookletUpgrade && <div className="modal-backdrop" onClick={() => setBookletUpgrade(false)}><div className="category-modal" onClick={(e) => e.stopPropagation()}><button className="modal-close" onClick={() => setBookletUpgrade(false)}><X size={18} /></button><span className="section-label">DEMO-HINWEIS</span><h2>Büchlein-Werkstatt</h2><p>Im Gratismonat sind unbegrenzt Büchlein verfügbar – keine Sperre. Nach Ablauf kannst du weiterhin alle Funktionen testen.</p><div className="confirm-row"><button className="cancel-btn" onClick={() => setBookletUpgrade(false)}>Weiter erstellen</button><button className="primary-button" onClick={() => { setBookletUpgrade(false); setSettingsOpen(true); setSettingsTab('abo'); }}>Abo ansehen</button></div></div></div>}

      {trialOffer && <div className="modal-backdrop" onClick={() => setTrialOffer(false)}><div className="category-modal" onClick={(e) => e.stopPropagation()}><button className="modal-close" onClick={() => setTrialOffer(false)}><X size={18} /></button><span className="section-label">GRATISMONAT BEENDET</span><h2>Dein 30-Tage Gratismonat ist abgelaufen</h2><p>Dies ist eine Demo-App – alle Funktionen bleiben weiter nutzbar. Im Store kannst du dir die Abo-Modelle ansehen.</p><div className="confirm-row"><button className="cancel-btn" onClick={() => setTrialOffer(false)}>Weiter nutzen</button><button className="primary-button" onClick={() => { setTrialOffer(false); setSettingsOpen(true); setSettingsTab('abo'); }}>Store ansehen</button></div></div></div>}

      {onboarding && <WelcomeFlow onComplete={(r) => void completeOnboarding(r)} uiLang={settings.uiLang} setUiLang={(lang) => updateSettings({ uiLang: lang })} />}

      {locked && (
        <div className="modal-backdrop lock-screen">
          <div className="lock-modal">
            <div className="lock-monogram" style={{ background: `linear-gradient(135deg, var(--gold), var(--forest))` }}>{displayInitial}</div>
            <span className="eyebrow">{workspace.name.trim().toUpperCase()}S UNIVERSUM</span>
            <h2>Willkommen zurück</h2>
            <p>{settings.protection === 'pin' ? 'PIN eingeben zum Entsperren' : 'Passwort eingeben zum Entsperren'}</p>
            <div className="password-input-wrapper">
              <input type={(settings.protection === 'pin' || !showLockPassword) ? 'password' : 'text'} value={lockInput} onChange={(e) => { setLockInput(e.target.value); setLockError(false); }} onKeyDown={(e) => { if (e.key === 'Enter') void unlockApp(); }} className={lockError ? 'lock-error' : ''} placeholder={settings.protection === 'pin' ? 'PIN' : 'Passwort'} autoFocus />
              {settings.protection !== 'pin' && <button className="password-toggle" onClick={() => setShowLockPassword((v) => !v)}>{showLockPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>}
            </div>
            {lockError && <span className="lock-error-msg">Falsche Eingabe – bitte erneut versuchen</span>}
            <button className="primary-button full-width" onClick={() => void unlockApp()}>Entsperren</button>
          </div>
        </div>
      )}

      {purchaseDialog && (
        <div className="modal-backdrop" onClick={() => { if (!purchaseSuccess) setPurchaseDialog(null); }}>
          <div className="category-modal purchase-modal" onClick={(e) => e.stopPropagation()}>
            {!purchaseSuccess ? <>
              <button className="modal-close" onClick={() => setPurchaseDialog(null)}><X size={18} /></button>
              <span className="section-label">DEMO-APP</span>
              <h2>{tierInfo[purchaseDialog.tier].name} ansehen</h2>
              <div className="purchase-summary">
                <div className="purchase-row"><span>Paket</span><strong>{tierInfo[purchaseDialog.tier].name}</strong></div>
                <div className="purchase-row"><span>Intervall</span><strong>{settings.billingInterval === 'monthly' ? 'Monatlich' : 'Jährlich'}</strong></div>
                <div className="purchase-row"><span>Preis</span><strong>{formatPrice(tierInfo[purchaseDialog.tier].price[settings.billingInterval])}{tierInfo[purchaseDialog.tier].price[settings.billingInterval] > 0 ? ` / ${settings.billingInterval === 'monthly' ? 'Monat' : 'Jahr'}` : ''}</strong></div>
              </div>
              <ul className="tier-features">{tierInfo[purchaseDialog.tier].features.map((f, i) => <li key={i}><CheckCircle2 size={13} /> {f}</li>)}</ul>
              <p className="purchase-test-hint">Dies ist eine Demo-App. Es werden keine echten Zahlungen ausgelöst – alle Funktionen sind frei nutzbar.</p>
              <div className="confirm-row">
                <button className="cancel-btn" onClick={() => setPurchaseDialog(null)}>Abbrechen</button>
                <button className="primary-button" onClick={confirmPurchase}><CreditCard size={16} /> Demo-Aktivierung</button>
              </div>
            </> : <>
              <div className="purchase-success"><CheckCircle2 size={36} /></div>
              <h2>{purchaseSuccess}</h2>
              <p>Alle Premium-Funktionen sind freigeschaltet – ohne Neuladen. (Demo)</p>
            </>}
          </div>
        </div>
      )}
      {protectionDialog && (
        <div className="modal-backdrop" onClick={() => setProtectionDialog(null)}>
          <div className="category-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setProtectionDialog(null)}><X size={18} /></button>
            <span className="section-label">{protectionDialog.mode === 'change' ? 'SCHUTZ ÄNDERN' : 'SCHUTZ EINRICHTEN'}</span>
            <h2>{protectionDialog.type === 'pin' ? 'PIN-Code festlegen' : 'Passwort festlegen'}</h2>
            <p className="settings-hint">{protectionDialog.type === 'pin' ? '4 oder 6 Ziffern – nur Zahlen.' : 'Bis zu 20 Zeichen, mit Groß-/Kleinschreibung und Zahlen.'}</p>
            {protectionDialog.mode === 'setup' && (
              <div className="protection-options">
                <button className={`protection-btn ${protectionDialog.type === 'pin' ? 'active' : ''}`} onClick={() => setProtectionDialog((d) => d ? { ...d, type: 'pin', value: '' } : d)}>PIN-Code</button>
                <button className={`protection-btn ${protectionDialog.type === 'password' ? 'active' : ''}`} onClick={() => setProtectionDialog((d) => d ? { ...d, type: 'password', value: '' } : d)}>Passwort</button>
              </div>
            )}
            <div className="password-input-wrapper">
              <input autoFocus type={protectionDialog.type === 'pin' || !showPassword ? 'password' : 'text'} value={protectionDialog.value} onChange={(e) => setProtectionDialog((d) => d ? { ...d, value: e.target.value.slice(0, 20) } : d)} onKeyDown={(e) => { if (e.key === 'Enter') void confirmProtectionDialog(); }} placeholder={protectionDialog.type === 'pin' ? '4-6 Ziffern' : 'Passwort'} className="settings-input" style={{ fontSize: '18px', textAlign: 'center', letterSpacing: protectionDialog.type === 'pin' ? '0.3em' : 'normal' }} />
              {protectionDialog.type !== 'pin' && <button className="password-toggle" onClick={() => setShowPassword((v) => !v)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>}
            </div>
            {protectionDialog.type === 'pin' && protectionDialog.value.length > 0 && !/^\d{4,6}$/.test(protectionDialog.value) && <span className="lock-error-msg">PIN muss 4 oder 6 Ziffern sein.</span>}
            <div className="confirm-row">
              <button className="cancel-btn" onClick={() => setProtectionDialog(null)}>Abbrechen</button>
              <button className="primary-button" onClick={() => void confirmProtectionDialog()} disabled={!protectionDialog.value.trim() || (protectionDialog.type === 'pin' && !/^\d{4,6}$/.test(protectionDialog.value))}>Bestätigen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

declare global {
  interface Window { SpeechRecognition?: new () => SpeechRecognition; webkitSpeechRecognition?: new () => SpeechRecognition; }
  interface SpeechRecognition extends EventTarget { lang: string; continuous: boolean; interimResults: boolean; onresult: ((event: SpeechRecognitionEvent) => void) | null; onerror: ((event: Event) => void) | null; onend: (() => void) | null; start: () => void; stop: () => void; }
  interface SpeechRecognitionEvent extends Event { resultIndex: number; results: SpeechRecognitionResultList; }
}