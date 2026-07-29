const ACTIONS = {
  soft: [
    "Imite {target} pendant 30 secondes.",
    "Fais 10 pompes en chantant une chanson d'amour.",
    "Danse sans musique pendant 20 secondes devant tout le monde.",
    "Fais rire tout le monde en moins de 30 secondes.",
    "Fais une imitation d'un joueur du groupe jusqu'à ce qu'il devine qui c'est.",
    "Chante un extrait d'une chanson que tu aimes devant le groupe.",
    "Raconte ta pire drague en moins de 15 secondes.",
    "Dis 15 pays en moins de 30 secondes.",
    "Cite 15 marques de voitures en moins de 30 secondes.",
    "Pendant 1 minute, le groupe te pose des questions et tu ne peux répondre que par \"oui\".",
    "Laisse le groupe te donner un surnom que tu gardes jusqu'à la fin de la partie.",
    "Fais un compliment sincère à {target}, les yeux dans les yeux.",
  ],
  hard: [
    "Chuchote quelque chose à l'oreille de {target}, sans que personne d'autre entende.",
    "Fais un câlin de 10 secondes à {target}.",
    "Montre la dernière photo prise sur ton téléphone au groupe.",
    "Montre ton fond d'écran actuel au groupe.",
    "Joue le rôle d'un coach en amour pendant 1 minute devant le groupe.",
    "Décris ton type idéal devant tout le monde.",
  ],
};

const TRUTHS = {
  soft: [
    "Quel est ton pire souvenir de soirée ?",
    "Quelle est la chose la plus gênante que tu aies faite devant {target} ?",
    "Quel est ton plus grand rêve ?",
    "Qu'est-ce qui te met le plus en colère ?",
    "Quel est le plus beau compliment que tu aies reçu ?",
    "Quelle application utilises-tu le plus ?",
    "Quelle est la plus grosse humiliation de ta vie ?",
    "Quel est ton plus grand mensonge à un(e) ex ?",
  ],
  hard: [
    "Qui est ton dernier crush ?",
    "Quel est ton plus grand red flag ?",
    "Quel est ton plus gros secret que presque personne ne connaît ?",
    "As-tu déjà aimé deux personnes en même temps ?",
    "As-tu déjà été rejeté(e) ? Raconte.",
    "As-tu déjà rejeté quelqu'un sans raison ? Raconte.",
    "Quelle est la qualité la plus attirante chez une personne pour toi ?",
    "Décris ton crush actuel en 5 mots, sans donner son prénom.",
    "Quelle est la plus longue période où tu es resté(e) célibataire ?",
    "Quel est ton green flag le plus important ?",
    "Décris ton premier rendez-vous idéal avec {target}.",
    "Sur qui du groupe craquerais-tu si tu étais célibataire ?",
  ],
};

const CONSEQUENCES = [
  "Tu portes un objet ridicule sur la tête jusqu'à ton prochain tour.",
  "Tu parles avec un accent au choix du groupe pendant 2 manches.",
  "Tu dois complimenter tout le monde avant la prochaine manche.",
  "Tu bois un verre d'eau cul sec.",
  "Le groupe choisit ta prochaine réponse à ta place.",
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fillTemplate(text, playerNames, excludeName) {
  const others = playerNames.filter((p) => p !== excludeName);
  const target = others.length ? pick(others) : excludeName;
  return text.replace(/\{target\}/g, target);
}

module.exports = { ACTIONS, TRUTHS, CONSEQUENCES, pick, fillTemplate };
