
    const fileInput = document.getElementById('fileInput');
    const passwordInput = document.getElementById('passwordInput');
    const tokenInput = document.getElementById('tokenInput');

    const encryptButton = document.getElementById('encryptButton');
    const decryptButton = document.getElementById('decryptButton');
    const listFilesButton = document.getElementById('listFilesButton');

    const result = document.getElementById('result');
    const fileList = document.getElementById('fileList');

    // ID du fichier actuellement sélectionné
    let selectedFileId = null;


    // ============================================================
    // CHIFFREMENT + UPLOAD
    // ============================================================

    encryptButton.addEventListener('click', async () => {

      try {

        const file = fileInput.files[0];
        const password = passwordInput.value;
        const token = tokenInput.value.trim();

        if (!file) {
          throw new Error('Sélectionnez un fichier.');
        }

        if (!password) {
          throw new Error('Entrez un mot de passe.');
        }

        if (!token) {
          throw new Error('Entrez le JWT.');
        }

        result.textContent = 'Lecture du fichier...';

        const fileBuffer = await file.arrayBuffer();

        result.textContent = 'Chiffrement en cours...';

        const encrypted = await encryptFile(
          fileBuffer,
          password
        );

        result.textContent = 'Envoi du fichier chiffré...';

        const formData = new FormData();

        const encryptedBlob = new Blob(
          [encrypted.ciphertext],
          {
            type: 'application/octet-stream'
          }
        );

        formData.append(
          'file',
          encryptedBlob,
          file.name + '.bin'
        );

        formData.append(
          'salt',
          encrypted.salt
        );

        formData.append(
          'iv',
          encrypted.iv
        );

        formData.append(
          'sha256Hash',
          encrypted.sha256Hash
        );

        formData.append(
          'originalName',
          file.name
        );


        const response = await fetch(
          '/api/files',
          {
            method: 'POST',

            headers: {
              Authorization: `Bearer ${token}`
            },

            body: formData
          }
        );


        const data = await response.json();


        if (!response.ok) {

          throw new Error(
            data.error ||
            'Erreur lors de l\'upload.'
          );

        }


        result.textContent =
          'Upload réussi !\n\n' +

          'ID du fichier : ' +
          data.fileId +

          '\n' +

          'Nom original : ' +
          data.originalName +

          '\n' +

          'Taille chiffrée : ' +
          data.size +
          ' octets' +

          '\n' +

          'Share token : ' +
          data.shareToken;


        // Actualiser automatiquement la liste
        await loadFiles();


      } catch (error) {

        console.error(error);

        result.textContent =
          'ERREUR : ' +
          error.message;

      }

    });


    // ============================================================
    // RÉCUPÉRER LA LISTE DES FICHIERS
    // ============================================================

    async function loadFiles() {

      try {

        const token =
          tokenInput.value.trim();


        if (!token) {

          throw new Error(
            'Entrez le JWT.'
          );

        }


        result.textContent =
          'Récupération de la liste des fichiers...';


        const response = await fetch(
          '/api/files',
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );


        const data =
          await response.json();


        if (!response.ok) {

          throw new Error(
            data.error ||
            'Impossible de récupérer les fichiers.'
          );

        }


        // Vider la liste actuelle
        fileList.innerHTML = '';


        if (data.files.length === 0) {

          fileList.innerHTML =
            '<li>Aucun fichier.</li>';

          result.textContent =
            'Aucun fichier dans le coffre.';

          return;

        }


        // Créer un élément pour chaque fichier
        data.files.forEach((file) => {

          const li =
            document.createElement('li');


          li.textContent =
            `${file.original_name} — ` +
            `${file.size_bytes} octets `;


          const button =
            document.createElement('button');


          button.textContent =
            'Sélectionner';


          button.addEventListener(
            'click',
            () => {

              selectedFileId =
                file.id;


              result.textContent =
                'Fichier sélectionné : ' +
                file.original_name +
                '\n' +
                'ID : ' +
                file.id;

            }
          );


          li.appendChild(button);

          fileList.appendChild(li);

        });


        result.textContent =
          `${data.files.length} fichier(s) trouvé(s).`;


      } catch (error) {

        console.error(error);

        result.textContent =
          'ERREUR : ' +
          error.message;

      }

    }


    // ============================================================
    // DÉCHIFFREMENT D'UN FICHIER
    // ============================================================

    async function decryptFileById(fileId) {

      try {

        const password =
          passwordInput.value;


        const token =
          tokenInput.value.trim();


        if (!password) {

          throw new Error(
            'Entrez le mot de passe de chiffrement.'
          );

        }


        if (!token) {

          throw new Error(
            'Entrez le JWT.'
          );

        }


        result.textContent =
          'Récupération des métadonnées...';


        // --------------------------------------------------------
        // 1. Récupérer les métadonnées
        // --------------------------------------------------------

        const metadataResponse =
          await fetch(
            `/api/files/${fileId}/metadata`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`
              }
            }
          );


        const metadata =
          await metadataResponse.json();


        if (!metadataResponse.ok) {

          throw new Error(
            metadata.error ||
            'Impossible de récupérer les métadonnées.'
          );

        }


        // --------------------------------------------------------
        // 2. Télécharger le ciphertext
        // --------------------------------------------------------

        result.textContent =
          'Téléchargement du fichier chiffré...';


        const fileResponse =
          await fetch(
            `/api/files/${fileId}`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`
              }
            }
          );


        if (!fileResponse.ok) {

          const errorData =
            await fileResponse.json();


          throw new Error(
            errorData.error ||
            'Impossible de télécharger le fichier.'
          );

        }


        const ciphertext =
          await fileResponse.arrayBuffer();


        // --------------------------------------------------------
        // 3. Déchiffrer avec AES-GCM
        // --------------------------------------------------------

        result.textContent =
          'Déchiffrement en cours...';


        const plaintext =
          await decryptFile(
            ciphertext,
            password,
            metadata.salt,
            metadata.iv,
            metadata.sha256Hash
          );


        // --------------------------------------------------------
        // 4. Préparer le fichier original
        // --------------------------------------------------------

        const blob =
          new Blob([plaintext]);


        const downloadUrl =
          URL.createObjectURL(blob);


        const link =
          document.createElement('a');


        link.href =
          downloadUrl;


        link.download =
          metadata.originalName;


        document.body.appendChild(link);


        link.click();


        link.remove();


        URL.revokeObjectURL(
          downloadUrl
        );


        // --------------------------------------------------------
        // 5. Résultat
        // --------------------------------------------------------

        result.textContent =
          'Déchiffrement réussi !\n\n' +

          'Fichier : ' +
          metadata.originalName +

          '\n' +

          'Taille : ' +
          plaintext.byteLength +
          ' octets' +

          '\n' +

          'Intégrité SHA-256 : OK';


      } catch (error) {

        console.error(error);

        result.textContent =
          'ERREUR : ' +
          error.message;

      }

    }


    // ============================================================
    // BOUTON DÉCHIFFREMENT
    // ============================================================

    decryptButton.addEventListener(
      'click',
      async () => {

        if (!selectedFileId) {

          result.textContent =
            'Sélectionnez d\'abord un fichier dans la liste.';

          return;

        }


        await decryptFileById(
          selectedFileId
        );

      }
    );


    // ============================================================
    // BOUTON ACTUALISER
    // ============================================================

    listFilesButton.addEventListener(
      'click',
      loadFiles
    );

 
