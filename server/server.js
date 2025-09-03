
const express    = require('express');
const multer     = require('multer');
const fs         = require('fs');
const path       = require('path');
const bcrypt     = require('bcrypt');

const app        = express();
const PORT       = process.env.PORT || 3000;
const DATA_FILE  = path.resolve(__dirname, '../SiteRoot/data/characters.json');
const SALT_ROUNDS = 10;
const ADMIN_KEY_FILE = path.resolve(__dirname, '../SiteRoot/data/admin_key.txt');

// Initialize admin key if it doesn't exist
async function initializeAdminKey() {
  try {
    if (!fs.existsSync(ADMIN_KEY_FILE)) {
      // Generate a secure admin key with specific requirements:
      // - Minimum length: 32 characters
      // - Must include: uppercase, lowercase, numbers, special characters
      // - No ambiguous characters (0,O,1,l,I)
      function generateSecureKey(length = 12) {
        const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        const lowercase = 'abcdefghijkmnopqrstuvwxyz';
        const numbers = '23456789';
        const special = '#$@!%&*?';
        const all = uppercase + lowercase + numbers + special;

        let key = '';
        // Ensure at least one of each type
        key += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
        key += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
        key += numbers.charAt(Math.floor(Math.random() * numbers.length));
        key += special.charAt(Math.floor(Math.random() * special.length));

        // Fill the rest randomly
        for(let i = key.length; i < length; i++) {
          key += all.charAt(Math.floor(Math.random() * all.length));
        }

        // Shuffle the string
        return key.split('').sort(() => Math.random() - 0.5).join('');
      }

      const adminKey = generateSecureKey();
      const hashedAdminKey = await bcrypt.hash(adminKey, SALT_ROUNDS);

      fs.writeFileSync(ADMIN_KEY_FILE, hashedAdminKey);
      console.log('New admin key generated:', adminKey);
      console.log('IMPORTANT: Save this admin key securely. It must be:');
      console.log('- At least 12 characters long');
      console.log('- Contain uppercase letters (A-Z, excluding O)');
      console.log('- Contain lowercase letters (a-z, excluding l)');
      console.log('- Contain numbers (2-9)');
      console.log('- Contain special characters (#$@!%&*?)');
      console.log('This key will not be shown again.');
    }
  } catch (err) {
    console.error('Error initializing admin key:', err);
  }
}

// Call this when server starts
initializeAdminKey();


// Middleware for JSON bodies
app.use(express.json());

// Multer: in-memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 *1024 * 1024
  }
});

// Utility: read/write the JSON data file
function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// POST /upload — upload + secret key (hashed)
app.post('/upload', upload.single('file'), async (req, res) => {
  const userKey   = req.body.key;
  const discordId = req.body.DiscordId || '';

  if (!userKey) {
    return res.status(400).json({ error: 'Missing key' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'Missing file' });
  }

  // Parse JSON payload
  let payload;
  try {
    payload = JSON.parse(req.file.buffer.toString());
  } catch {
    return res.status(400).json({ error: 'Invalid JSON in file' });
  }

  // Validate required CharName field
  if (!payload.CharName || typeof payload.CharName !== 'string' || !payload.CharName.trim()) {
    return res.status(400).json({ error: 'Invalid save file: Missing or invalid CharName' });
  }

  // Extract only the desired fields
  const {
    CharName,
    CharClass,
    CharLevel,
    CharacterInv,
    CharacterEquip,
    EquipSlotQuantities,
    CharacterSpells,
    CharacterSkills,
    TutorialsDone,
    CurHP,
    CurMana,
    CurrentXP,
    Gold,
    CompletedQuests,
    ActiveQuests,
    Keyring,
    AuraItem,
    CharmItem,
    CharmQual
  } = payload;

  const all = readData();

  // Look for existing record by comparing character name and hashes
  let existingIndex = all.findIndex(record =>
    record.CharName === CharName &&
    record.hashedKey &&
    bcrypt.compareSync(userKey, record.hashedKey)
  );

  // Hash the submitted key for storing
  const hashedKey = await bcrypt.hash(userKey, SALT_ROUNDS);

  // Build the stored record
  const record = {
    index:            null,   // to be set below
    hashedKey,               // store only the hash
    CharName,
    CharClass,
    CharLevel,
    DiscordId:        discordId,
    CharacterInv,
    CharacterEquip,
    EquipSlotQuantities,
    CharacterSpells,
    CharacterSkills,
    TutorialsDone,
    CurHP,
    CurMana,
    CurrentXP,
    Gold,
    CompletedQuests,
    ActiveQuests,
    Keyring,
    AuraItem,
    CharmItem,
    CharmQual
  };

  if (existingIndex > -1) {
    // Replace existing (preserve its index)
    record.index         = all[existingIndex].index;
    all[existingIndex]   = record;
    writeData(all);

    return res.json({
      success: true,
      message: 'Character updated',
      index:   record.index
    });
  }

  // Append new record
  record.index = all.length
    ? Math.max(...all.map(o => o.index)) + 1
    : 1;

  all.push(record);
  writeData(all);

  return res.json({
    success: true,
    message: 'Character added',
    index:   record.index
  });
});

// GET /characters — list all { index, CharName, CharClass, CharLevel, DiscordId }
app.get('/characters', (req, res) => {
  const list = readData().map(({
    index,
    CharName,
    CharClass,
    CharLevel,
    DiscordId
  }) => ({
    index,
    CharName,
    CharClass,
    CharLevel,
    DiscordId: DiscordId || ''
  }));
  res.json(list);
});

// GET /character/:index — full data (exclude hashedKey)
app.get('/character/:index', (req, res) => {
  const idx   = parseInt(req.params.index, 10);
  const found = readData().find(obj => obj.index === idx);

  if (!found) {
    return res.status(404).json({ error: 'Character not found' });
  }

  // Omit hashedKey from response
  const { hashedKey, ...publicData } = found;
  res.json(publicData);
});

// Function to check if a key matches the admin key
async function isAdminKey(key) {
  try {
    const adminKeyPath = path.resolve(__dirname, '../SiteRoot/data/admin_key.txt');
    const adminKey = fs.readFileSync(adminKeyPath, 'utf-8').trim();
    return bcrypt.compareSync(key, adminKey);
  } catch (err) {
    console.error('Error reading admin key:', err);
    return false;
  }
}

// DELETE /character - delete a character with name and key validation
app.delete('/character', async (req, res) => {
  const { characterName, key } = req.body;

  if (!characterName || !key) {
    return res.status(400).json({ error: 'Missing character name or key' });
  }

  const all = readData();
  const characterToDelete = all.find(record => record.CharName === characterName);

  if (!characterToDelete) {
    return res.status(404).json({ error: 'Character not found' });
  }

  // Check if the key is either the player's key or the admin key
  const isValidPlayerKey = bcrypt.compareSync(key, characterToDelete.hashedKey);
  const isValidAdmin = await isAdminKey(key);

  if (!isValidPlayerKey && !isValidAdmin) {
    return res.status(403).json({ error: 'Invalid key' });
  }

  // Remove the character from the array
  const characterIndex = all.findIndex(record => record.CharName === characterName);
  all.splice(characterIndex, 1);
  writeData(all);

  return res.json({
    success: true,
    message: 'Character deleted successfully'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
