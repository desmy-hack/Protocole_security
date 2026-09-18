const FileService = {
  async upload(file, password, onProgress) {
    onProgress?.(15, 'Lecture du fichier…');
    const arrayBuffer = await file.arrayBuffer();

    onProgress?.(35, 'Chiffrement AES-GCM…');
    const { ciphertext, salt, iv, sha256Hash } = await encryptFile(arrayBuffer, password);

    onProgress?.(70, 'Envoi vers le serveur…');
    const form = new FormData();
    form.append('file', new Blob([ciphertext]), 'encrypted.bin');
    form.append('salt', salt);
    form.append('iv', iv);
    form.append('sha256Hash', sha256Hash);
    form.append('originalName', file.name);

    const result = await API.post('/api/files', form);
    onProgress?.(100, 'Terminé.');
    return result;
  },

  async list() {
    const { files } = await API.get('/api/files');
    return files;
  },

  async remove(id) {
    return API.request(`/api/files/${id}`, { method: 'DELETE' });
  },

  shareUrl(shareToken) {
    return `${location.origin}/share.html#${shareToken}`;
  },
};
