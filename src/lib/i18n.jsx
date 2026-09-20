import { useEffect, useMemo, useState } from "react";
import { LanguageContext } from "./i18nContext";

const translations = {
  es: {
    "Select language": "Seleccionar idioma",
    Support: "Soporte",
    Group: "Grupo",
    "About Us": "Sobre nosotros",
    "Our Packages": "Nuestros paquetes",
    FAQ: "Preguntas frecuentes",
    "Contact Us": "Contactanos",
    Login: "Iniciar sesion",
    "Sign up": "Registrarse",
    "Return to home": "Volver al inicio",
    "Open Support Center": "Abrir centro de soporte",
    Networks: "Redes",
    "Sign me up": "Registrarme",
    "Get started": "Comenzar",
    "Our packages": "Nuestros paquetes",
    "What is MeridianVests?": "Que es MeridianVests?",
    "Secure, innovative, and user-friendly crypto management solutions.":
      "Soluciones de gestion de criptomonedas seguras, innovadoras y faciles de usar.",
    "What we do": "Lo que hacemos",
    "Why MeridianVests": "Por que MeridianVests",
    "How to get started": "Como comenzar",
    "Create an account and start exploring.":
      "Crea una cuenta y comienza a explorar.",
    Testimonial: "Testimonio",
    "Our members' investment and profits experience.":
      "La experiencia de inversion y ganancias de nuestros miembros.",
    "Start investing now!!": "Comienza a invertir ahora!!",
    "About MeridianVests.": "Sobre MeridianVests.",
    "Our story": "Nuestra historia",
    "Crypto management made clearer and more intentional.":
      "Gestion de criptomonedas mas clara e intencional.",
    "Choose the structure that fits your capital goals.":
      "Elige la estructura que se adapta a tus objetivos de capital.",
    "Answers for members who value clarity.":
      "Respuestas para miembros que valoran la claridad.",
    "Request assistance.": "Solicita asistencia.",
    "Support Center": "Centro de soporte",
    "Request Assistance": "Solicitar asistencia",
    "Full name": "Nombre completo",
    "Email address": "Correo electronico",
    Message: "Mensaje",
    "Submit request": "Enviar solicitud",
    "Sending...": "Enviando...",
    "Starter Plan": "Plan inicial",
    "Regular Plan": "Plan regular",
    "Pro Plan": "Plan profesional",
    "Premium Plan": "Plan premium",
    "Minimum deposit": "Deposito minimo",
    "Maximum deposit": "Deposito maximo",
    "Daily yield": "Rendimiento diario",
    Duration: "Duracion",
    "Deposit return": "Retorno del deposito",
    "14 Calendar Days": "14 dias calendario",
    YES: "SI",
  },
  fr: {
    "Select language": "Choisir la langue",
    Support: "Assistance",
    Group: "Groupe",
    "About Us": "A propos",
    "Our Packages": "Nos forfaits",
    FAQ: "FAQ",
    "Contact Us": "Nous contacter",
    Login: "Connexion",
    "Sign up": "S'inscrire",
    "Return to home": "Retour a l'accueil",
    "Open Support Center": "Ouvrir le centre d'assistance",
    Networks: "Reseaux",
    "Sign me up": "Je m'inscris",
    "Get started": "Commencer",
    "Our packages": "Nos forfaits",
    "What is MeridianVests?": "Qu'est-ce que MeridianVests ?",
    "Secure, innovative, and user-friendly crypto management solutions.":
      "Des solutions de gestion crypto securisees, innovantes et faciles a utiliser.",
    "What we do": "Ce que nous faisons",
    "Why MeridianVests": "Pourquoi MeridianVests",
    "How to get started": "Comment commencer",
    "Create an account and start exploring.":
      "Creez un compte et commencez a explorer.",
    Testimonial: "Temoignage",
    "Our members' investment and profits experience.":
      "L'experience d'investissement et de profits de nos membres.",
    "Start investing now!!": "Commencez a investir maintenant !!",
    "About MeridianVests.": "A propos de MeridianVests.",
    "Our story": "Notre histoire",
    "Crypto management made clearer and more intentional.":
      "Une gestion crypto plus claire et plus pertinente.",
    "Choose the structure that fits your capital goals.":
      "Choisissez la structure adaptee a vos objectifs de capital.",
    "Answers for members who value clarity.":
      "Des reponses pour les membres qui privilegient la clarte.",
    "Request assistance.": "Demander de l'aide.",
    "Support Center": "Centre d'assistance",
    "Request Assistance": "Demander de l'aide",
    "Full name": "Nom complet",
    "Email address": "Adresse e-mail",
    Message: "Message",
    "Submit request": "Envoyer la demande",
    "Sending...": "Envoi...",
    "Starter Plan": "Forfait debutant",
    "Regular Plan": "Forfait regulier",
    "Pro Plan": "Forfait pro",
    "Premium Plan": "Forfait premium",
    "Minimum deposit": "Depot minimum",
    "Maximum deposit": "Depot maximum",
    "Daily yield": "Rendement quotidien",
    Duration: "Duree",
    "Deposit return": "Retour du depot",
    "14 Calendar Days": "14 jours calendaires",
    YES: "OUI",
  },
  de: {
    "Select language": "Sprache auswahlen",
    Support: "Support",
    Group: "Gruppe",
    "About Us": "Uber uns",
    "Our Packages": "Unsere Pakete",
    FAQ: "FAQ",
    "Contact Us": "Kontakt",
    Login: "Anmelden",
    "Sign up": "Registrieren",
    "Return to home": "Zur Startseite",
    "Open Support Center": "Supportcenter offnen",
    Networks: "Netzwerke",
    "Sign me up": "Registrieren",
    "Get started": "Loslegen",
    "Our packages": "Unsere Pakete",
    "What is MeridianVests?": "Was ist MeridianVests?",
    "Secure, innovative, and user-friendly crypto management solutions.":
      "Sichere, innovative und benutzerfreundliche Kryptoverwaltung.",
    "What we do": "Was wir tun",
    "Why MeridianVests": "Warum MeridianVests",
    "How to get started": "So starten Sie",
    "Create an account and start exploring.":
      "Erstellen Sie ein Konto und entdecken Sie die Moglichkeiten.",
    Testimonial: "Erfahrungsbericht",
    "Our members' investment and profits experience.":
      "Die Anlage- und Gewinnerfahrung unserer Mitglieder.",
    "Start investing now!!": "Jetzt investieren!!",
    "About MeridianVests.": "Uber MeridianVests.",
    "Our story": "Unsere Geschichte",
    "Crypto management made clearer and more intentional.":
      "Kryptoverwaltung klarer und bewusster gestaltet.",
    "Choose the structure that fits your capital goals.":
      "Wahlen Sie die Struktur fur Ihre Kapitalziele.",
    "Answers for members who value clarity.":
      "Antworten fur Mitglieder, die Klarheit schatzen.",
    "Request assistance.": "Hilfe anfordern.",
    "Support Center": "Supportcenter",
    "Request Assistance": "Hilfe anfordern",
    "Full name": "Vollstandiger Name",
    "Email address": "E-Mail-Adresse",
    Message: "Nachricht",
    "Submit request": "Anfrage senden",
    "Sending...": "Wird gesendet...",
    "Starter Plan": "Starter-Paket",
    "Regular Plan": "Standard-Paket",
    "Pro Plan": "Pro-Paket",
    "Premium Plan": "Premium-Paket",
    "Minimum deposit": "Mindesteinzahlung",
    "Maximum deposit": "Maximaleinzahlung",
    "Daily yield": "Tagliche Rendite",
    Duration: "Laufzeit",
    "Deposit return": "Einzahlungsruckgabe",
    "14 Calendar Days": "14 Kalendertage",
    YES: "JA",
  },
  pt: {
    "Select language": "Selecionar idioma",
    Support: "Suporte",
    Group: "Grupo",
    "About Us": "Sobre nos",
    "Our Packages": "Nossos pacotes",
    FAQ: "Perguntas frequentes",
    "Contact Us": "Fale conosco",
    Login: "Entrar",
    "Sign up": "Cadastrar",
    "Return to home": "Voltar ao inicio",
    "Open Support Center": "Abrir central de suporte",
    Networks: "Redes",
    "Sign me up": "Quero me cadastrar",
    "Get started": "Comecar",
    "Our packages": "Nossos pacotes",
    "What is MeridianVests?": "O que e MeridianVests?",
    "Secure, innovative, and user-friendly crypto management solutions.":
      "Solucoes de gestao de criptomoedas seguras, inovadoras e faceis de usar.",
    "What we do": "O que fazemos",
    "Why MeridianVests": "Por que a MeridianVests",
    "How to get started": "Como comecar",
    "Create an account and start exploring.":
      "Crie uma conta e comece a explorar.",
    Testimonial: "Depoimento",
    "Our members' investment and profits experience.":
      "A experiencia de investimento e lucro dos nossos membros.",
    "Start investing now!!": "Comece a investir agora!!",
    "About MeridianVests.": "Sobre a MeridianVests.",
    "Our story": "Nossa historia",
    "Crypto management made clearer and more intentional.":
      "Gestao de criptomoedas mais clara e planejada.",
    "Choose the structure that fits your capital goals.":
      "Escolha a estrutura que combina com seus objetivos de capital.",
    "Answers for members who value clarity.":
      "Respostas para membros que valorizam a clareza.",
    "Request assistance.": "Solicite ajuda.",
    "Support Center": "Central de suporte",
    "Request Assistance": "Solicitar ajuda",
    "Full name": "Nome completo",
    "Email address": "Endereco de e-mail",
    Message: "Mensagem",
    "Submit request": "Enviar solicitacao",
    "Sending...": "Enviando...",
    "Starter Plan": "Plano inicial",
    "Regular Plan": "Plano regular",
    "Pro Plan": "Plano profissional",
    "Premium Plan": "Plano premium",
    "Minimum deposit": "Deposito minimo",
    "Maximum deposit": "Deposito maximo",
    "Daily yield": "Rendimento diario",
    Duration: "Duracao",
    "Deposit return": "Retorno do deposito",
    "14 Calendar Days": "14 dias corridos",
    YES: "SIM",
  },
  it: {
    "Select language": "Seleziona lingua",
    Support: "Supporto",
    Group: "Gruppo",
    "About Us": "Chi siamo",
    "Our Packages": "I nostri pacchetti",
    FAQ: "FAQ",
    "Contact Us": "Contatti",
    Login: "Accedi",
    "Sign up": "Registrati",
    "Return to home": "Torna alla home",
    "Open Support Center": "Apri il centro assistenza",
    Networks: "Reti",
    "Sign me up": "Registrami",
    "Get started": "Inizia",
    "Our packages": "I nostri pacchetti",
    "What is MeridianVests?": "Cos'e MeridianVests?",
    "Secure, innovative, and user-friendly crypto management solutions.":
      "Soluzioni di gestione crypto sicure, innovative e facili da usare.",
    "What we do": "Cosa facciamo",
    "Why MeridianVests": "Perche MeridianVests",
    "How to get started": "Come iniziare",
    "Create an account and start exploring.":
      "Crea un account e inizia a esplorare.",
    Testimonial: "Testimonianza",
    "Our members' investment and profits experience.":
      "L'esperienza di investimento e profitto dei nostri membri.",
    "Start investing now!!": "Inizia a investire ora!!",
    "About MeridianVests.": "Informazioni su MeridianVests.",
    "Our story": "La nostra storia",
    "Crypto management made clearer and more intentional.":
      "Gestione crypto piu chiara e consapevole.",
    "Choose the structure that fits your capital goals.":
      "Scegli la struttura adatta ai tuoi obiettivi di capitale.",
    "Answers for members who value clarity.":
      "Risposte per i membri che cercano chiarezza.",
    "Request assistance.": "Richiedi assistenza.",
    "Support Center": "Centro assistenza",
    "Request Assistance": "Richiedi assistenza",
    "Full name": "Nome completo",
    "Email address": "Indirizzo email",
    Message: "Messaggio",
    "Submit request": "Invia richiesta",
    "Sending...": "Invio...",
    "Starter Plan": "Piano iniziale",
    "Regular Plan": "Piano regolare",
    "Pro Plan": "Piano pro",
    "Premium Plan": "Piano premium",
    "Minimum deposit": "Deposito minimo",
    "Maximum deposit": "Deposito massimo",
    "Daily yield": "Rendimento giornaliero",
    Duration: "Durata",
    "Deposit return": "Restituzione deposito",
    "14 Calendar Days": "14 giorni di calendario",
    YES: "SI",
  },
  nl: {
    "Select language": "Taal selecteren",
    Support: "Ondersteuning",
    Group: "Groep",
    "About Us": "Over ons",
    "Our Packages": "Onze pakketten",
    FAQ: "Veelgestelde vragen",
    "Contact Us": "Contact",
    Login: "Inloggen",
    "Sign up": "Registreren",
    "Return to home": "Terug naar home",
    "Open Support Center": "Supportcentrum openen",
    Networks: "Netwerken",
    "Sign me up": "Registreren",
    "Get started": "Aan de slag",
    "Our packages": "Onze pakketten",
    "What is MeridianVests?": "Wat is MeridianVests?",
    "Secure, innovative, and user-friendly crypto management solutions.":
      "Veilige, innovatieve en gebruiksvriendelijke crypto-oplossingen.",
    "What we do": "Wat wij doen",
    "Why MeridianVests": "Waarom MeridianVests",
    "How to get started": "Zo begint u",
    "Create an account and start exploring.":
      "Maak een account en begin met ontdekken.",
    Testimonial: "Ervaring",
    "Our members' investment and profits experience.":
      "De investerings- en winstervaring van onze leden.",
    "Start investing now!!": "Begin nu met investeren!!",
    "About MeridianVests.": "Over MeridianVests.",
    "Our story": "Ons verhaal",
    "Crypto management made clearer and more intentional.":
      "Cryptobeheer duidelijker en doelgerichter gemaakt.",
    "Choose the structure that fits your capital goals.":
      "Kies de structuur die bij uw kapitaaldoelen past.",
    "Answers for members who value clarity.":
      "Antwoorden voor leden die duidelijkheid waarderen.",
    "Request assistance.": "Hulp aanvragen.",
    "Support Center": "Supportcentrum",
    "Request Assistance": "Hulp aanvragen",
    "Full name": "Volledige naam",
    "Email address": "E-mailadres",
    Message: "Bericht",
    "Submit request": "Aanvraag versturen",
    "Sending...": "Verzenden...",
    "Starter Plan": "Starterpakket",
    "Regular Plan": "Standaardpakket",
    "Pro Plan": "Pro-pakket",
    "Premium Plan": "Premiumpakket",
    "Minimum deposit": "Minimale storting",
    "Maximum deposit": "Maximale storting",
    "Daily yield": "Dagelijks rendement",
    Duration: "Duur",
    "Deposit return": "Teruggave storting",
    "14 Calendar Days": "14 kalenderdagen",
    YES: "JA",
  },
  zh: {
    "Select language": "选择语言",
    Support: "支持",
    Group: "集团",
    "About Us": "关于我们",
    "Our Packages": "我们的套餐",
    FAQ: "常见问题",
    "Contact Us": "联系我们",
    Login: "登录",
    "Sign up": "注册",
    "Return to home": "返回首页",
    "Open Support Center": "打开支持中心",
    Networks: "网络",
    "Sign me up": "立即注册",
    "Get started": "开始使用",
    "Our packages": "我们的套餐",
    "What is MeridianVests?": "什么是 MeridianVests？",
    "Secure, innovative, and user-friendly crypto management solutions.":
      "安全、创新且易于使用的加密货币管理方案。",
    "What we do": "我们的服务",
    "Why MeridianVests": "为什么选择 MeridianVests",
    "How to get started": "如何开始",
    "Create an account and start exploring.": "创建账户并开始探索。",
    Testimonial: "用户评价",
    "Our members' investment and profits experience.": "会员的投资与收益体验。",
    "Start investing now!!": "现在开始投资！！",
    "About MeridianVests.": "关于 MeridianVests。",
    "Our story": "我们的故事",
    "Crypto management made clearer and more intentional.":
      "让加密货币管理更清晰、更有规划。",
    "Choose the structure that fits your capital goals.":
      "选择适合您资金目标的方案。",
    "Answers for members who value clarity.": "为重视透明度的会员提供答案。",
    "Request assistance.": "请求帮助。",
    "Support Center": "支持中心",
    "Request Assistance": "请求帮助",
    "Full name": "姓名",
    "Email address": "电子邮箱",
    Message: "留言",
    "Submit request": "提交请求",
    "Sending...": "发送中...",
    "Starter Plan": "入门套餐",
    "Regular Plan": "标准套餐",
    "Pro Plan": "专业套餐",
    "Premium Plan": "高级套餐",
    "Minimum deposit": "最低存款",
    "Maximum deposit": "最高存款",
    "Daily yield": "每日收益",
    Duration: "期限",
    "Deposit return": "存款返还",
    "14 Calendar Days": "14个日历日",
    YES: "是",
  },
};

const reverseTranslations = Object.fromEntries(
  Object.entries(translations).flatMap(([language, entries]) =>
    Object.entries(entries).map(([source, translated]) => [translated, source]),
  ),
);

function translateText(text, language) {
  const value = text.trim();
  const source = reverseTranslations[value] || value;
  const translated = translations[language]?.[source] || source;
  return text.replace(value, translated);
}

function translateAttribute(value, language) {
  const source = reverseTranslations[value] || value;
  return translations[language]?.[source] || source;
}

function shouldTranslateTextNode(node) {
  return (
    node.parentElement &&
    !["SCRIPT", "STYLE", "OPTION"].includes(node.parentElement.tagName)
  );
}

function translateAttributes(element, language) {
  ["placeholder", "title", "aria-label"].forEach((attribute) => {
    const value = element.getAttribute(attribute);
    if (!value) return;
    const translated = translateAttribute(value, language);
    if (translated !== value) element.setAttribute(attribute, translated);
  });
}

function translateSubtree(root, language) {
  if (root.nodeType === Node.TEXT_NODE) {
    if (!shouldTranslateTextNode(root)) return;
    const nextText = translateText(root.nodeValue, language);
    if (nextText !== root.nodeValue) root.nodeValue = nextText;
    return;
  }

  if (root.nodeType !== Node.ELEMENT_NODE) return;

  translateAttributes(root, language);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (shouldTranslateTextNode(node)) {
      const nextText = translateText(node.nodeValue, language);
      if (nextText !== node.nodeValue) node.nodeValue = nextText;
    }
    node = walker.nextNode();
  }

  root
    .querySelectorAll("[placeholder], [title], [aria-label]")
    .forEach((element) => translateAttributes(element, language));
}

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(
    () => localStorage.getItem("legacy-language") || "en",
  );

  useEffect(() => {
    localStorage.setItem("legacy-language", language);
    document.documentElement.lang = language;

    const appRoot = document.getElementById("root");
    if (!appRoot) return undefined;

    translateSubtree(appRoot, language);

    let frameId = null;
    const pendingRoots = new Set();
    const flushPendingRoots = () => {
      frameId = null;
      pendingRoots.forEach((root) => translateSubtree(root, language));
      pendingRoots.clear();
    };
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(({ addedNodes }) => {
        addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
            pendingRoots.add(node);
          }
        });
      });
      if (pendingRoots.size && frameId === null) {
        frameId = window.requestAnimationFrame(flushPendingRoots);
      }
    });
    observer.observe(appRoot, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      pendingRoots.clear();
    };
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage }), [language]);
  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
