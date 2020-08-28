const express = require("express");
const app = express();
const MongoClient = require("mongodb").MongoClient;
const session = require("express-session");
const bodyParser = require("body-parser");

app.use(
  session({
    secret: "mon texte secret",
    resave: true,
    saveUninitialized: true,
  })
);
app.use(bodyParser.urlencoded({ extended: false }));

// Variable qui contiendra toutes les propriétés nécessaires pour le pug utilisé :  titre, session…
let textesPug = {};

// Traitement effectué pour chaque requête au serveur
app.use((req, res, next) => {
  // Si la propriété utilisateur de req.session n'existe pas, je vais la créer
  if (!req.session.utilisateur) {
    req.session.utilisateur = {};
  }
  // Si la propriété message de app.locals n'existe pas, je vais la créer
  if (!app.locals.message) {
    app.locals.message = {};
  }
  // Nous récupérons dans la propriété message de la variable textesPug un éventuel message contenu dans app.locals.message. Ceci est nécessaire lorsqu'il y a l'utilisation d'un res.redirect() dans une route et qu'il faut passer un message d'une route à l'autre
  textesPug.message = app.locals.message;
  app.locals.message = {};
  // Nous passons les informations enregistrées en session à la variable textesPug pour utiliser celles-ci dans le pug qui sera appelé (ceci permet par exemple de filtrer certains affichages en fonction du statut de la personne)
  textesPug.utilisateur = req.session.utilisateur;
  next();
});

app.set("view engine", "pug");
app.use("/css", express.static(__dirname + "/assets/css"));
app.use("/js", express.static(__dirname + "/assets/js"));

const urlDB = "mongodb://localhost:27017";
const nameDb = "un-blog";

app.get("/", (req, res, next) => {
  textesPug.titre = `Page d'accueil`;
  res.render("accueil", textesPug);
});

app.get("/connecter", (req, res, next) => {
  textesPug.titre = `Se connecter`;
  res.render("connection", textesPug);
});

app.get("/deconnecter", (req, res, next) => {
  // Méthode destroy de session pour supprimer la session
  req.session.destroy((err) => {
    // Nous stockons dans la propriété la message un texte avec une coloration pour une class bootstrap qui seront utilisés dans le pug qui sera appelé dans la route correspondant à la page d'accueil
    app.locals.message = { class: "primary", texte: "Vous êtes déconnecté" };
    // res.redirect('/') permet d'appeler la route correspondant à la page d'accueil
    res.redirect("/");
  });
});

app.get("/admin/accueil", (req, res, next) => {
  textesPug.titre = `Accueil de l'administration`;
  res.render("admin-accueil", textesPug);
});

app.post("/connecter-verif", (req, res, next) => {
  if (!req.body.pseudo || !req.body.mdp) {
    app.locals.message = {
      class: "warning",
      texte: "Pseudo et/ou le mot de passe non fourni(s).",
    };
    res.redirect("/connecter");
  } else {
    MongoClient.connect(urlDB, { useUnifiedTopology: true }, (err, client) => {
      if (err) return;
      const collection = client.db(nameDb).collection("utilisateurs");
      collection
        .find({ pseudo: req.body.pseudo, mdp: req.body.mdp })
        .toArray((err, data) => {
          if (data.length) {
            req.session.utilisateur.pseudo = data[0].pseudo;
            req.session.utilisateur.niveau = data[0].niveau;
            textesPug.utilisateur = req.session.utilisateur;
            textesPug.message = {
              class: "success",
              texte: "Vous êtes bien connecté",
            };
            textesPug.titre = `Accueil de l'administration`;
            res.render("admin-accueil", textesPug);
          } else {
            app.locals.message = {
              class: "danger",
              texte: "Pseudo et/ou le mot de passe incorrect(s).",
            };
            res.redirect("/connecter");
          }
        });
    });
  }
});

app.get("/admin/ajout-utilisateur", (req, res, next) => {
  textesPug.titre = "Ajouter un utilisateur";
  res.render("admin-ajout-utilisateur", textesPug);
});

app.post("/admin/ajout-utilisateur-verif", (req, res, next) => {
  const niveau = parseInt(req.body.niveau);
  // Le test ci-dessous permet de s'assure que pseudo et mot de passe sont fournis et que le niveau est un nombre ayant une des valeurs admises (cf. tableau ci-dessous)
  if (!req.body.pseudo || !req.body.mdp || [1, 5, 10].indexOf(niveau) == -1) {
    app.locals.message = {
      class: "warning",
      texte: "Il manque des informations.",
    };
    res.redirect("/admin/ajout-utilisateur");
  } else {
    MongoClient.connect(urlDB, { useUnifiedTopology: true }, (err, client) => {
      if (err) return;
      const collection = client.db(nameDb).collection("utilisateurs");
      collection.insertOne(
        {
          pseudo: req.body.pseudo,
          mdp: req.body.mdp,
          niveau: niveau,
          prenom: req.body.prenom,
          nom: req.body.nom,
          rue: req.body.rue,
          cp: req.body.cp,
          ville: req.body.ville,
          telephone: req.body.telephone,
        },
        (err, r) => {
          client.close();
          if (err) {
            app.locals.message = {
              class: "danger",
              texte: `Le nouvel utilisateur n'a pas pu être enregistré.`,
            };
            res.redirect("/admin/ajout-utilisateur");
          } else {
            app.locals.message = {
              class: "success",
              texte: `Le nouvel utilisateur a été enregistré.`,
            };
            res.redirect("/admin/accueil");
          }
        }
      );
    });
  }
});

app.get("/admin/liste-utilisateur", (req, res, next) => {
  MongoClient.connect(urlDB, { useUnifiedTopology: true }, (err, client) => {
    if (err) return;
    const collection = client.db(nameDb).collection("utilisateurs");
    collection.find().toArray((err, data) => {
      textesPug.titre = "Liste des utilisateurs";
      textesPug.listeUtilisateurs = data;
      res.render("admin-liste-utilisateurs", textesPug);
    });
  });
});

app.get("/admin/modifier-utilisateur/:pseudo", (req, res, next) => {
  MongoClient.connect(urlDB, { useUnifiedTopology: true }, (err, client) => {
    if (err) return;
    const collection = client.db(nameDb).collection("utilisateurs");
    collection.find({ pseudo: req.params.pseudo }).toArray((err, data) => {
      if (data.length) {
        textesPug.titre = `Modifier  ${req.params.pseudo}`;
        textesPug.donneesUtilisateur = data[0];
        res.render("admin-modif-utilisateur", textesPug);
      } else {
        // Si on ne trouve pas un utilisateur dans la bdd, on redirige vers la liste des utilisateurs avec un message d'avertissement
        app.locals.message = { class: "danger", texte: `Utilisateur inconnu.` };
        res.redirect("/admin/liste-utilisateur");
      }
    });
  });
});

app.post("/admin/modifier-utilisateur-verif", (req, res, next) => {
  const niveau = parseInt(req.body.niveau);
  // Le test ci-dessous permet de s'assure que pseudo et mot de passe sont fournis et que le niveau est un nombre ayant une des valeurs admises (cf. tableau ci-dessous)
  if (!req.body.pseudo || !req.body.mdp || [1, 5, 10].indexOf(niveau) == -1) {
    app.locals.message = {
      class: "warning",
      texte: "Il manque des informations.",
    };
    res.redirect("/admin/liste-utilisateur");
  } else {
    MongoClient.connect(urlDB, { useUnifiedTopology: true }, (err, client) => {
      if (err) return;
      const collection = client.db(nameDb).collection("utilisateurs");
      collection.find({ pseudo: req.body.pseudo }).toArray((err, data) => {
        if (data.length) {
          collection.updateOne(
            { pseudo: req.body.pseudo },
            {
              $set: {
                pseudo: req.body.pseudo,
                mdp: req.body.mdp,
                niveau: niveau,
                prenom: req.body.prenom,
                nom: req.body.nom,
                rue: req.body.rue,
                cp: req.body.cp,
                ville: req.body.ville,
                telephone: req.body.telephone,
              },
            },
            (err, r) => {
              client.close();
              if (err) {
                app.locals.message = {
                  class: "danger",
                  texte: `L'utilisateur ${req.body.pseudo} n'a pas pu être modifié.`,
                };
                res.redirect("/admin/liste-utilisateur");
              } else {
                app.locals.message = {
                  class: "success",
                  texte: `L'utilisateur ${req.body.pseudo} a pu être modifié.`,
                };
                res.redirect("/admin/liste-utilisateur");
              }
            }
          );
        } else {
          // Si on ne trouve pas un utilisateur dans la bdd, on redirige vers la liste des utilisateurs avec un message d'avertissement
          app.locals.message = {
            class: "danger",
            texte: `L'utilisateur à mofidier est inconnu.`,
          };
          res.redirect("/admin/liste-utilisateur");
        }
      });
    });
  }
});

app.get("/admin/supprimer-utilisateur/:pseudo", (req, res, next) => {
  MongoClient.connect(urlDB, { useUnifiedTopology: true }, (err, client) => {
    if (err) return;
    const collection = client.db(nameDb).collection("utilisateurs");
    collection.find({ pseudo: req.params.pseudo }).toArray((err, data) => {
      if (data.length) {
        collection.deleteOne({ pseudo: req.params.pseudo }, (err, r) => {
          app.locals.message = {
            class: "success",
            texte: `L'utilisateur à bien été supprimé.`,
          };
          client.close();
          res.redirect("/admin/liste-utilisateur");
        });
      } else {
        client.close();
        app.locals.message = {
          class: "danger",
          texte: `L'utilisateur à supprimer est inconnu.`,
        };
        res.redirect("/admin/liste-utilisateur");
      }
    });
  });
});

app.listen("8080", () => console.log("Écoute sur le port 8080"));
