// app.js
document.addEventListener('DOMContentLoaded', () => {
  // Element references
  const openUploadBtn    = document.getElementById('open-upload-btn');
  const uploadModal      = document.getElementById('upload-modal');
  const closeUploadModal = document.getElementById('close-upload-modal');
  const uploadForm       = document.getElementById('upload-form');
  const fileInput        = document.getElementById('file-input');
  const keyInput         = document.getElementById('key-input');
  const discordInput     = document.getElementById('discord-input');
  const uploadMsg        = document.getElementById('upload-message');

  const searchInput      = document.getElementById('search-input');
  const showAllBtn       = document.getElementById('show-all-btn');
  const resultsBody      = document.getElementById('results-list');
  const paginationDiv    = document.getElementById('pagination');

  const modal            = document.getElementById('modal');
  const closeModal       = document.getElementById('close-modal');

  const API_BASE     = '/SiteRoot/api';
  const ITEM_XML_URL = '../items.xml';
  const SPELL_XML_URL = '../spells.xml';
  const SKILL_XML_URL = '../skills.xml';
  const ROWS_PER_PAGE = 25;

  // In-memory data
  let characters   = [];
  let filteredChars = [];
  let currentPage = 1;
  let itemDefsMap  = {};
  let spellDefsMap = {};
  let skillDefsMap = {};

  // Fixed slot layout: 4 – 5 – 3 – 5
  const rows = [
    ['Aura','Charm','Head','Neck'],
    ['Ring 1','Hands','Torso','Shoulders','Ring 2'],
    ['Wrist 1','Legs','Wrist 2'],
    ['Primary','Waist','Feet','Back','Secondary']
  ];

  // Helper: fetch text→JSON with error propagation
  function fetchJson(url, opts = {}) {
    return fetch(url, opts).then(res => {
      if (!res.ok) return res.text().then(t => { throw new Error(`HTTP ${res.status}: ${t}`); });
      return res.json();
    });
  }

  // 1) Load item definitions XML → itemDefsMap
  function loadItemDefinitions() {
    return fetch(ITEM_XML_URL)
      .then(r => r.text())
      .then(xmlText => {
        const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
        doc.querySelectorAll('Item').forEach(el => {
          /*const id    = el.getAttribute('id');*/
          const id    = el.querySelector('id')?.textContent;
          const slot  = el.querySelector('Slot')?.textContent;
          const name  = el.querySelector('Name')?.textContent;
          const image = el.querySelector('Image')?.textContent;
          if (id && slot) itemDefsMap[id] = { slot, name, image };
        });
      });
  }

  // parse XML utility for Spells and Skills
  function loadXmlDefs(url, tagName, map) {
    return fetch(url)
      .then(r => r.text())
      .then(xmlText => {
        const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
        doc.querySelectorAll(tagName).forEach(el => {
          const id = el.querySelector('id')?.textContent;
          const name = el.querySelector('name')?.textContent;
          const image = el.querySelector('image')?.textContent;
          if (id) map[id] = { name, image };
        });
      });
  }

  // 2) Load all characters from server → characters & filteredChars
  function loadCharacters() {
    return fetchJson(`${API_BASE}/characters`)
      .then(data => {
        characters    = data;
        filteredChars = data.slice();
        currentPage   = 1;
        renderPage();
      })
      .catch(err => {
        console.error('Failed to load characters:', err);
        resultsBody.innerHTML = `<tr><td colspan="4" class="error">
          Error loading characters: ${err.message}
        </td></tr>`;
      });
  }

  // 3) Render single page of the (filtered) list
  function renderPage() {
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    const pageItems = filteredChars.slice(start, start + ROWS_PER_PAGE);

    // build rows
    resultsBody.innerHTML = '';
    if (!pageItems.length) {
      resultsBody.innerHTML = '<tr><td colspan="4">No characters found.</td></tr>';
    } else {
      pageItems.forEach(({ index, CharName, CharClass, CharLevel, DiscordId }) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>
            <a href="#"
               class="char-link"
               data-idx="${index}">
              ${CharName}
            </a>
          </td>
          <td>${CharClass}</td>
          <td>${CharLevel}</td>
          <td>${DiscordId || ''}</td>
        `;
        resultsBody.appendChild(tr);
      });

      // wire up detail‐modal links
      document.querySelectorAll('.char-link').forEach(a => {
        a.addEventListener('click', e => {
          e.preventDefault();
          showDetails(a.dataset.idx);
        });
      });
    }

    renderPaginationControls();
  }

  // 4) Build pagination buttons
  function renderPaginationControls() {
    const totalPages = Math.ceil(filteredChars.length / ROWS_PER_PAGE);
    if (totalPages <= 1) {
      paginationDiv.innerHTML = '';
      return;
    }

    let html = '';
    // Prev
    html += `<button ${currentPage===1?'disabled':''} data-page="${currentPage-1}">← Prev</button>`;

    // page numbers (current ±2)
    const start = Math.max(1, currentPage - 2);
    const end   = Math.min(totalPages, currentPage + 2);
    for (let p = start; p <= end; p++) {
      html += `<button class="${p===currentPage?'current':''}" data-page="${p}">${p}</button>`;
    }

    // Next
    html += `<button ${currentPage===totalPages?'disabled':''} data-page="${currentPage+1}">Next →</button>`;

    paginationDiv.innerHTML = html;
    paginationDiv.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = Number(btn.dataset.page);
        if (p >= 1 && p <= totalPages) {
          currentPage = p;
          renderPage();
        }
      });
    });
  }

  // 5) Sorting columns (affects full `characters`, then re-filter & page1)
  document.querySelectorAll('#char-table th').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      const asc = !th.classList.contains('asc');

      characters.sort((a, b) => {
        if (a[key] < b[key]) return asc ? -1 : 1;
        if (a[key] > b[key]) return asc ? 1 : -1;
        return 0;
      });

      // header classes
      document.querySelectorAll('#char-table th')
        .forEach(h => h.classList.remove('asc','desc'));
      th.classList.toggle('asc', asc);
      th.classList.toggle('desc', !asc);

      // reapply filter + go page 1
      applyFilter();
      currentPage = 1;
      renderPage();
    });
  });

  // 6) Search & Show-All
  searchInput.addEventListener('input', () => {
    applyFilter();
    currentPage = 1;
    renderPage();
  });
  showAllBtn.addEventListener('click', () => {
    searchInput.value = '';
    applyFilter();
    currentPage = 1;
    renderPage();
  });
  function applyFilter() {
    const term = searchInput.value.trim().toLowerCase();
    filteredChars = term === ''
      ? characters.slice()
      : characters.filter(c => c.CharName.toLowerCase().includes(term));
  }

  // 7) Hook up tab buttons
  document.querySelectorAll('.modal-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      // Deactivate all tabs and panels
      document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.modal-tab-content').forEach(p => p.classList.remove('active'));

      // Activate clicked tab
      btn.classList.add('active');
      // Show matching panel
      const panel = document.getElementById('tab-' + btn.dataset.tab);
      panel.classList.add('active');
    });
  });

  // Delete character functionality
  function deleteCharacter(characterName) {
    const key = prompt("Please enter your secret key to confirm deletion:");
    if (!key) {
      return; // User cancelled
    }

    fetch(`${API_BASE}/character`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        characterName,
        key
      })
    })
    .then(response => {
      if (!response.ok) {
        return response.json().then(data => {
          throw new Error(data.error || 'Failed to delete character');
        });
      }
      return response.json();
    })
    .then(data => {
      alert('Character deleted successfully');
      modal.classList.add('hidden');
      loadCharacters(); // Refresh the character list
    })
    .catch(error => {
      alert(error.message || 'Failed to delete character');
    });
  }

  // 8) Details modal for one character
  function showDetails(idx) {

    // always switch back to Main tab on open
    document.querySelectorAll('.modal-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === 'main');
    });
    document.querySelectorAll('.modal-tab-content').forEach(panel => {
      panel.classList.toggle('active', panel.id === 'tab-main');
    });

    fetchJson(`${API_BASE}/character/${idx}`)
      .then(data => {
        // header
        document.getElementById('char-name').textContent       = data.CharName || 'Unknown';
        document.getElementById('char-class-level').textContent =
          `${data.CharClass || 'Unknown Class'} • Level ${data.CharLevel || '?'}`;

        // build slot→item map
        const equipIds = data.CharacterEquip || [];
        const equipped = {};
        const ringList = [];
        const wristList = [];
        const weaponList = [];

        // Handle Aura item separately since it comes from AuraItem field
        if (data.AuraItem) {
          const auraItem = itemDefsMap[data.AuraItem];
          if (auraItem) {
            equipped['Aura'] = { id: data.AuraItem, name: auraItem.name, image: auraItem.image };
          }
        }

        // Handle Charm item separately since it comes from AuraItem field
        if (data.CharmItem) {
          const CharmItem = itemDefsMap[data.CharmItem];
          if (CharmItem) {
            equipped['Charm'] = { id: data.CharmItem, name: CharmItem.name, image: CharmItem.image };
          }
        }

        equipIds.forEach(itemId => {
          const def = itemDefsMap[itemId];
          if (!def || !def.slot) return;

          const slotKey = def.slot.toLowerCase();

          if (slotKey === 'ring') {
            ringList.push({ id: itemId, name: def.name, image: def.image });
          }
          else if (slotKey === 'wrist') {
            wristList.push({ id: itemId, name: def.name, image: def.image });
          }
          else if (slotKey === 'primaryorsecondary') {
            weaponList.push({ id: itemId, name: def.name, image: def.image });
          }
          else if (slotKey === 'primary') {
           equipped['Primary'] = { id: itemId, name: def.name, image: def.image };
          }
          else if (slotKey === 'secondary') {
            equipped['Secondary'] = { id: itemId, name: def.name, image: def.image };
          }
          else {
            // everything else goes straight to its named slot
            equipped[def.slot] = { id: itemId, name: def.name, image: def.image };
          }
        });

        weaponList.forEach(weapon => {
        if (!equipped['Primary']) {
          equipped['Primary'] = weapon;
        } else if (!equipped['Secondary']) {
          equipped['Secondary'] = weapon;
        }
      });

      // drop them into the two numbered slots (if present)
      equipped['Ring 1']   = ringList[0] || null;
      equipped['Ring 2']   = ringList[1] || null;
      equipped['Wrist 1']  = wristList[0] || null;
      equipped['Wrist 2']  = wristList[1] || null;

        // render grid
        rows.forEach(slotNames => {
          slotNames.forEach(name => {
            const slotEl = document.querySelector(`.slot[data-slot="${name}"]`);
            if (!slotEl) return;

            // Remove old event listeners and content
            const newSlot = slotEl.cloneNode(false);
            slotEl.parentNode.replaceChild(newSlot, slotEl);
            newSlot.classList.remove('empty-slot');

            const item = equipped[name];
            // Add mouseover events for tooltip for all slots
            newSlot.addEventListener('mousemove', (e) => {
                const tooltip = document.getElementById('item-tooltip');
                tooltip.textContent = item ? item.name : 'Empty';
                tooltip.style.display = 'block';
                tooltip.style.left = (e.pageX + 15) + 'px';
                tooltip.style.top = (e.pageY + 15) + 'px';
            });

            newSlot.addEventListener('mouseleave', () => {
                const tooltip = document.getElementById('item-tooltip');
                tooltip.style.display = 'none';
            });

            if (item) {
              const img = document.createElement('img');
              img.alt = item.name;
              img.style.maxWidth  = '80%';
              img.style.maxHeight = '80%';
              img.onerror = () => {
                img.remove();
                const span = document.createElement('span');
                span.textContent = item.id;
                span.classList.add('item-id-fallback');
                newSlot.appendChild(span);
              };
              img.src = `/assets/items/${item.image}?v=${Date.now()}`;
              newSlot.appendChild(img);
            } else {
              newSlot.classList.add('empty-slot');
            }
          });
        });

        // Populate Quests
        const completedQuests = data.CompletedQuests || [];
        const activeQuests = data.ActiveQuests || [];

        const completedHtml = completedQuests.length
          ? completedQuests.map(q => `<div class="quest-entry completed">✓ ${q}</div>`).join('')
          : '<div class="quest-entry empty">No completed quests</div>';

        const activeHtml = activeQuests.length
          ? activeQuests.map(q => `<div class="quest-entry active">→ ${q}</div>`).join('')
          : '<div class="quest-entry empty">No active quests</div>';

        document.getElementById('quest-columns').innerHTML = `
          <div class="quest-column">
          <h4>Completed (${completedQuests.length})</h4>
          <div class="quest-scroll">
            ${completedHtml}
          </div>
        </div>

  <div class="quest-column">
    <h4>Active (${activeQuests.length})</h4>
    <div class="quest-scroll">
      ${activeHtml}
    </div>
  </div>
`;

        // Populate Skills (object of id → level)
        const skillsArray = Array.isArray(data.CharacterSkills)
          ? data.CharacterSkills
          : [];

        // Create rows of 5 skill tiles
        const skillRows = [];
        let currentRow = [];

        skillsArray.forEach(skillId => {
          const def = skillDefsMap[skillId] || {};
          const label = def.name || skillId;
          const image = def.image 
            ? `<img src="/assets/skills/${def.image}?v=${Date.now()}" alt="${label}">` 
            : '';

          currentRow.push(`
            <div class="skill-tile">
              ${image}
              <div class="skill-name">${label}</div>
            </div>
          `);

          if (currentRow.length === 5) {
            skillRows.push(`<div class="skill-row">${currentRow.join('')}</div>`);
            currentRow = [];
          }
        });

        // Add any remaining skills in the last row
        if (currentRow.length > 0) {
          skillRows.push(`<div class="skill-row">${currentRow.join('')}</div>`);
        }

        const skillsHtml = skillRows.length > 0 
          ? skillRows.join('') 
          : '<div class="skill-row"><div class="skill-tile">No skills</div></div>';

        document.getElementById('skills-grid').innerHTML = skillsHtml;

        // Populate Spells
        // Create rows of 5 spell tiles
        const spellRows = [];
        let spellRowItems = [];

        (data.CharacterSpells || []).forEach(spellId => {
          const def = spellDefsMap[spellId] || {};
          const label = def.name || spellId;
          const image = def.image
            ? `<img src="/assets/spells/${def.image}?v=${Date.now()}" alt="${label}">`
            : '';

          spellRowItems.push(`
            <div class="spell-tile">
              ${image}
              <div class="spell-name">${label}</div>
            </div>
          `);

          if (spellRowItems.length === 5) {
            spellRows.push(`<div class="spell-row">${spellRowItems.join('')}</div>`);
            spellRowItems = [];
          }
        });

        // Add any remaining spells in the last row
        if (spellRowItems.length > 0) {
          spellRows.push(`<div class="spell-row">${spellRowItems.join('')}</div>`);
        }

        const spellsHtml = spellRows.length > 0
          ? spellRows.join('') 
          : '<div class="spell-row"><div class="spell-tile empty">No spells</div></div>';

        document.getElementById('spells-grid').innerHTML = spellsHtml;

        modal.classList.remove('hidden');

        // Add event listener for delete button
        const deleteBtn = document.getElementById('delete-char-btn');
        if (deleteBtn) {
          // Remove any existing click handlers
          deleteBtn.removeEventListener('click', deleteBtn.onclick);
          // Add new click handler
          deleteBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to delete this character? This action cannot be undone.')) {
              deleteCharacter(data.CharName);
            }
          });
        } else {
          console.error('Delete button not found! Make sure you have added <button id="delete-char-btn">Delete Character</button> to your modal HTML');
        }

      })
      .catch(err => console.error('Failed to load details:', err));
  }

  // 8) Upload-modal open/close
  openUploadBtn.addEventListener('click', () => uploadModal.classList.remove('hidden'));
  closeUploadModal.addEventListener('click', () => uploadModal.classList.add('hidden'));

  // 9) Details modal close
  closeModal.addEventListener('click', () => modal.classList.add('hidden'));

  // 10) Upload form submit
  uploadForm.addEventListener('submit', e => {
  e.preventDefault();
  uploadMsg.textContent = '';

  const file    = fileInput.files[0];
  const key     = keyInput.value.trim();
  const discord = discordInput.value.trim();

  if (!file || !key) {
    uploadMsg.textContent = 'Please select a file and enter your secret key.';
    return;
  }

  // File size validation (max 2MB)
  const maxSizeBytes = 2 * 1024 * 1024; // 2MB
  if (file.size > maxSizeBytes) {
    uploadMsg.textContent = 'File too large. Maximum size is 2MB.';
    return;
  }

  // JSON validation - read and parse the file content
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const fileContent = e.target.result;
      JSON.parse(fileContent); // This will throw if invalid JSON
      
      // If JSON is valid, proceed with your original upload logic
      const fd = new FormData();
      fd.append('file', file);
      fd.append('key', key);
      if (discord) fd.append('DiscordId', discord);

      fetchJson(`${API_BASE}/upload`, { method: 'POST', body: fd })
        .then(resp => {
          uploadMsg.textContent = resp.updated
            ? `✔️ Updated: ${resp.message}`
            : `✔️ Added: ${resp.message}`;
          uploadForm.reset();
          return loadCharacters();
        })
        .catch(err => {
          console.error('Upload failed:', err);
          uploadMsg.textContent = `❌ ${err.message}`;
        });
    } catch (error) {
      uploadMsg.textContent = 'Invalid JSON file format.';
    }
  };
  reader.readAsText(file);
}); 

  // Initial hide & load
  uploadModal.classList.add('hidden');
  modal.classList.add('hidden');

  Promise.all([
  loadItemDefinitions(),
  loadXmlDefs(SPELL_XML_URL, 'Spell', spellDefsMap),
  loadXmlDefs(SKILL_XML_URL, 'Skill', skillDefsMap)
])
  .then(loadCharacters)
  .catch(err => console.error('Initialization error:', err));

});
