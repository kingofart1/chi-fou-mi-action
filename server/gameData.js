const ACTIONS = {
  soft: [
    "Imite {target} pendant 30 secondes.",
    "Fais 10 pompes en chantant une chanson d'amour.",
    "Envoie un message vocal ridicule à {target}.",
    "Danse sans musique pendant 20 secondes devant tout le monde.",
    "Raconte ta pire drague en moins de 15 secondes.",
    "Fais un compliment sincère à {target}, les yeux dans les yeux.",
    "Imite la façon dont {target} rit.",
  ],
  hard: [
    "Chuchote quelque chose à l'oreille de {target}, sans que personne d'autre entende.",
    "Fais un câlin de 10 secondes à {target}.",
    "Décris ton type idéal devant tout le monde.",
    "Laisse {target} choisir une photo dans ta galerie à montrer au groupe.",
  ],
};

const TRUTHS = {
  soft: [
    "Quel est ton pire souvenir de soirée ?",
    "Quelle est la chose la plus gênante que tu aies faite devant {target} ?",
    "Si tu devais sortir avec quelqu'un dans le groupe, ce serait qui et pourquoi ?",
    "Quel est ton plus grand mensonge à un(e) ex ?",
    "Quelle appli regardes-tu le plus en cachette ?",
  ],
  hard: [
    "Décris ton premier rendez-vous idéal avec {target}.",
    "Quelle est la chose la plus folle que tu aies faite pour attirer quelqu'un ?",
    "Sur qui du groupe craquerais-tu si tu étais célibataire ?",
    "Quel est ton fantasme de date le plus romantique ?",
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
