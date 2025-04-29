const { ipcRenderer } = require('electron');

// Wait for DOM to be fully loaded before initializing
document.addEventListener('DOMContentLoaded', () => {
    // Essential DOM Elements
    const searchBar = document.getElementById('searchBar');
    const searchBarMobile = document.getElementById('searchBarMobile');
    const searchButtonMobile = document.getElementById('searchButtonMobile');
    const searchModal = document.getElementById('searchModal');
    const closeSearchModal = document.getElementById('closeSearchModal');
    const loadingChannels = document.getElementById('loadingChannels');
    
    // Player elements
    const playerContainer = document.getElementById('playerContainer');
    const welcomeScreen = document.getElementById('welcomeScreen');
    const playerInfo = document.getElementById('playerInfo');
    const playerActions = document.getElementById('playerActions');
    const ytChannelTitle = document.getElementById('yt-channel-title');
    const ytChannelCategory = document.getElementById('yt-channel-category');
    const ytFavoriteBtn = document.getElementById('yt-favorite-btn');
    const favoritesCarousel = document.getElementById('favoritesCarousel');
    
    // Channel list elements
    const channelList = document.getElementById('channelList');
    const channelListColumn = document.getElementById('channelListColumn');
    const toggleChannelList = document.getElementById('toggleChannelList');
    const overlay = document.getElementById('overlay');
    const channelListTitle = document.querySelector('.channel-list-title');
    
    // Settings elements
    const settingsButton = document.getElementById('settingsButton');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const jsonUrlInput = document.getElementById('jsonUrlInput');
    const playlistNameInput = document.getElementById('playlistNameInput');
    const editPlaylistId = document.getElementById('editPlaylistId');
    const addPlaylistBtn = document.getElementById('addPlaylistBtn');
    const updatePlaylistBtn = document.getElementById('updatePlaylistBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const playlistsList = document.getElementById('playlistsList');
    const saveSettings = document.getElementById('saveSettings');
    const cancelSettings = document.getElementById('cancelSettings');
    const resetSettings = document.getElementById('resetSettings');
    const notification = document.getElementById('notification');
    const notificationMessage = document.getElementById('notificationMessage');
    
    // Playlist selector elements
    const playlistSelectorBtn = document.getElementById('playlistSelectorBtn');
    const playlistSelectorModal = document.getElementById('playlistSelectorModal');
    const closePlaylistSelectorBtn = document.getElementById('closePlaylistSelectorBtn');
    const playlistSelectorList = document.getElementById('playlistSelectorList');
    
    // Default JSON URL - update to point to M3U file
    const DEFAULT_JSON_URL = 'https://raw.githubusercontent.com/byte-capsule/Toffee-Channels-Link-Headers/refs/heads/main/toffee_OTT_Navigator.m3u';
    const DEFAULT_PLAYLIST_NAME = 'Default Playlist';
    
    // Global variables
    let channels = [];
    let filteredChannels = [];
    let favorites = JSON.parse(localStorage.getItem('favorites')) || {};
    let currentCategory = 'all';
    let currentChannel = null;
    let ytPlayer = null;
    let ytHls = null;
    
    // Playlists management
    let playlists = JSON.parse(localStorage.getItem('playlists')) || [];
    let activePlaylistId = localStorage.getItem('activePlaylistId') || '';
    
    // Initialize with default playlist if no playlists exist
    if (playlists.length === 0) {
      const defaultPlaylist = {
        id: generateUniqueId(),
        name: DEFAULT_PLAYLIST_NAME,
        url: DEFAULT_JSON_URL
      };
      playlists.push(defaultPlaylist);
      activePlaylistId = defaultPlaylist.id;
      
      // Save to localStorage
      localStorage.setItem('playlists', JSON.stringify(playlists));
      localStorage.setItem('activePlaylistId', activePlaylistId);
    } 
    // Ensure activePlaylistId points to a valid playlist
    else {
      // Check if the active playlist ID exists in the playlists array
      const activePlaylistExists = playlists.some(p => p.id === activePlaylistId);
      
      if (!activePlaylistExists) {
        // If active playlist doesn't exist, set the first playlist as active
        activePlaylistId = playlists[0].id;
        localStorage.setItem('activePlaylistId', activePlaylistId);
        console.log("Active playlist not found, using the first available playlist instead");
      }
    }
    
    // Function to generate a unique ID
    function generateUniqueId() {
      return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    // Function to show notification
    function showNotification(message, duration = 3000) {
      notificationMessage.textContent = message;
      notification.classList.add('show');
      setTimeout(() => {
        notification.classList.remove('show');
      }, duration);
    }
    
    // Function to get active playlist details
    function getActivePlaylist() {
      return playlists.find(p => p.id === activePlaylistId) || playlists[0];
    }
    
    // Function to render the quick playlist selector
    function renderPlaylistSelector() {
      playlistSelectorList.innerHTML = '';
      
      playlists.forEach((playlist, index) => {
        const isActive = playlist.id === activePlaylistId;
        
        const playlistItem = document.createElement('div');
        playlistItem.className = `playlist-selector-item ${isActive ? 'active' : ''}`;
        playlistItem.draggable = true;
        playlistItem.dataset.playlistId = playlist.id;
        playlistItem.dataset.index = index;
        
        playlistItem.innerHTML = `
          <i class="fa-solid fa-grip-vertical drag-handle" style="margin-right: 8px; cursor: grab;"></i>
          <i class="fa-${isActive ? 'solid' : 'regular'} fa-circle-check"></i>
          <span class="playlist-selector-item-name">${playlist.name}</span>
        `;
        
        playlistItem.addEventListener('click', (e) => {
          // Prevent activation when dragging
          if (!e.target.classList.contains('drag-handle')) {
            activatePlaylist(playlist.id, true);
          }
        });
        
        // Drag and drop events
        playlistItem.addEventListener('dragstart', handleDragStart);
        playlistItem.addEventListener('dragover', handleDragOver);
        playlistItem.addEventListener('drop', handleDrop);
        playlistItem.addEventListener('dragend', handleDragEnd);
        
        playlistSelectorList.appendChild(playlistItem);
      });
    }
    
    // Drag event handlers
    let draggedItem = null;
    let draggedIndex = null;

    function handleDragStart(e) {
      draggedItem = e.target;
      draggedIndex = parseInt(draggedItem.dataset.index);
      
      // Add dragging class for visual feedback
      draggedItem.classList.add('dragging');
      
      // Set cursor style for the drag operation
      const dragIcon = new Image();
      dragIcon.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      e.dataTransfer.setDragImage(dragIcon, 0, 0);
    }

    function handleDragOver(e) {
      e.preventDefault();
      const targetItem = e.target.closest('.playlist-selector-item');
      if (!targetItem || targetItem === draggedItem) return;
      
      // Remove any existing drag-over classes
      document.querySelectorAll('.playlist-selector-item').forEach(item => {
        item.classList.remove('drag-over-top', 'drag-over-bottom');
      });
      
      const targetRect = targetItem.getBoundingClientRect();
      const mouseY = e.clientY;
      const threshold = targetRect.top + (targetRect.height / 2);
      
      if (mouseY < threshold) {
        targetItem.classList.add('drag-over-top');
      } else {
        targetItem.classList.add('drag-over-bottom');
      }
    }

    function handleDrop(e) {
      e.preventDefault();
      const targetItem = e.target.closest('.playlist-selector-item');
      if (!targetItem || targetItem === draggedItem) return;
      
      // Remove drag-over classes
      document.querySelectorAll('.playlist-selector-item').forEach(item => {
        item.classList.remove('drag-over-top', 'drag-over-bottom');
      });
      
      const targetIndex = parseInt(targetItem.dataset.index);
      
      // Reorder the playlists array
      const [movedPlaylist] = playlists.splice(draggedIndex, 1);
      playlists.splice(targetIndex, 0, movedPlaylist);
      
      // Save the new order to localStorage
      localStorage.setItem('playlists', JSON.stringify(playlists));
      
      // Add drop animation to the target item
      targetItem.classList.add('drop-complete');
      
      // Remove the animation class after it completes
      setTimeout(() => {
        targetItem.classList.remove('drop-complete');
        // Re-render the playlist selector with the new order
        renderPlaylistSelector();
      }, 300);
    }

    function handleDragEnd(e) {
      // Remove dragging class
      draggedItem.classList.remove('dragging');
      
      // Clear any remaining drag styling
      document.querySelectorAll('.playlist-selector-item').forEach(item => {
        item.classList.remove('drag-over-top', 'drag-over-bottom');
      });
      
      draggedItem = null;
      draggedIndex = null;
    }

    // Function to render the playlists list
    function renderPlaylists() {
      playlistsList.innerHTML = '';
      
      if (playlists.length === 0) {
        playlistsList.innerHTML = `
          <div class="empty-playlists-message">No playlists added yet.</div>
        `;
        return;
      }
      
      playlists.forEach(playlist => {
        const isActive = playlist.id === activePlaylistId;
        
        const playlistItem = document.createElement('div');
        playlistItem.className = 'playlist-item';
        
        playlistItem.innerHTML = `
          <div class="playlist-info">
            <div class="playlist-name">${playlist.name}</div>
            <div class="playlist-url">${playlist.url}</div>
          </div>
          <div class="playlist-actions">
            <button class="playlist-action-btn edit" title="Edit Playlist">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button class="playlist-action-btn select ${isActive ? 'active' : ''}" title="${isActive ? 'Currently Active' : 'Select Playlist'}">
              <i class="fa-${isActive ? 'solid' : 'regular'} fa-circle-check"></i>
            </button>
            <button class="playlist-action-btn remove" title="Remove Playlist">
              <i class="fa-solid fa-trash-alt"></i>
            </button>
          </div>
        `;
        
        // Add event listeners to buttons
        const editBtn = playlistItem.querySelector('.playlist-action-btn.edit');
        editBtn.addEventListener('click', () => {
          editPlaylist(playlist.id);
        });
        
        const selectBtn = playlistItem.querySelector('.playlist-action-btn.select');
        selectBtn.addEventListener('click', () => {
          activatePlaylist(playlist.id);
        });
        
        const removeBtn = playlistItem.querySelector('.playlist-action-btn.remove');
        removeBtn.addEventListener('click', () => {
          removePlaylist(playlist.id);
        });
        
        playlistsList.appendChild(playlistItem);
      });
    }
    
    // Function to activate a playlist
    function activatePlaylist(playlistId, reloadPage = false) {
      if (activePlaylistId === playlistId) return;
      
      activePlaylistId = playlistId;
      localStorage.setItem('activePlaylistId', activePlaylistId);
      
      // Update UI to reflect the change
      renderPlaylists();
      
      const activePlaylist = playlists.find(p => p.id === playlistId);
      if (activePlaylist) {
        showNotification(`Switched to playlist: ${activePlaylist.name}`);
        
        if (reloadPage) {
          // Reload channels with new active playlist
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
      }
    }
    
    // Function to edit a playlist
    function editPlaylist(playlistId) {
      const playlist = playlists.find(p => p.id === playlistId);
      if (!playlist) return;
      
      // Fill form with playlist details
      playlistNameInput.value = playlist.name;
      jsonUrlInput.value = playlist.url;
      editPlaylistId.value = playlistId;
      
      // Show update and cancel buttons, hide add button
      addPlaylistBtn.style.display = 'none';
      updatePlaylistBtn.style.display = 'inline-flex';
      cancelEditBtn.style.display = 'inline-flex';
    }
    
    // Function to cancel edit mode
    function cancelEdit() {
      // Clear form
      playlistNameInput.value = '';
      jsonUrlInput.value = '';
      editPlaylistId.value = '';
      
      // Show add button, hide update and cancel buttons
      addPlaylistBtn.style.display = 'inline-flex';
      updatePlaylistBtn.style.display = 'none';
      cancelEditBtn.style.display = 'none';
    }
    
    // Function to update a playlist
    function updatePlaylist() {
      const playlistId = editPlaylistId.value;
      if (!playlistId) return;
      
      const name = playlistNameInput.value.trim();
      const url = jsonUrlInput.value.trim();
      
      if (!name) {
        showNotification('Please enter a playlist name');
        return;
      }
      
      if (!url) {
        showNotification('Please enter a playlist URL or file path');
        return;
      }
      
      // Find and update the playlist
      const playlistIndex = playlists.findIndex(p => p.id === playlistId);
      if (playlistIndex === -1) return;
      
      playlists[playlistIndex].name = name;
      playlists[playlistIndex].url = url;
      
      // Save to localStorage
      localStorage.setItem('playlists', JSON.stringify(playlists));
      
      // Update UI
      renderPlaylists();
      cancelEdit();
      
      showNotification(`Playlist "${name}" updated successfully`);
    }
    
    // Function to add a new playlist
    function addPlaylist(name, url) {
      if (!name || !url) return;
      
      const newPlaylist = {
        id: generateUniqueId(),
        name,
        url
      };
      
      playlists.push(newPlaylist);
      localStorage.setItem('playlists', JSON.stringify(playlists));
      
      // If it's the first playlist, make it active
      if (playlists.length === 1) {
        activePlaylistId = newPlaylist.id;
        localStorage.setItem('activePlaylistId', activePlaylistId);
      }
      
      renderPlaylists();
      showNotification(`Playlist "${name}" added successfully`);
      
      // Clear input fields
      playlistNameInput.value = '';
      jsonUrlInput.value = '';
    }
    
    // Function to remove a playlist
    function removePlaylist(playlistId) {
      // Don't allow removing the last playlist
      if (playlists.length <= 1) {
        showNotification('Cannot remove the last playlist');
        return;
      }
      
      const playlistToRemove = playlists.find(p => p.id === playlistId);
      if (!playlistToRemove) return;
      
      playlists = playlists.filter(p => p.id !== playlistId);
      localStorage.setItem('playlists', JSON.stringify(playlists));
      
      // If the removed playlist was active, activate the first one
      if (activePlaylistId === playlistId) {
        activePlaylistId = playlists[0].id;
        localStorage.setItem('activePlaylistId', activePlaylistId);
        showNotification(`Playlist removed. Switched to: ${playlists[0].name}`);
      } else {
        showNotification(`Playlist "${playlistToRemove.name}" removed`);
      }
      
      renderPlaylists();
    }
    
    // Get current active playlist URL
    function getActivePlaylistUrl() {
      const activePlaylist = playlists.find(p => p.id === activePlaylistId);
      return activePlaylist ? activePlaylist.url : DEFAULT_JSON_URL;
    }
    
    // Playlist Selector Modal Handlers
    playlistSelectorBtn.addEventListener('click', () => {
      renderPlaylistSelector();
      playlistSelectorModal.style.display = 'flex';
    });
    
    closePlaylistSelectorBtn.addEventListener('click', () => {
      playlistSelectorModal.style.display = 'none';
    });
    
    // Close playlist selector when clicking outside
    playlistSelectorModal.addEventListener('click', (e) => {
      if (e.target === playlistSelectorModal) {
        playlistSelectorModal.style.display = 'none';
      }
    });

    // Settings Modal Handlers
    settingsButton.addEventListener('click', () => {
      renderPlaylists();
      cancelEdit(); // Reset edit form
      settingsModal.style.display = 'flex';
    });

    closeSettingsBtn.addEventListener('click', () => {
      settingsModal.style.display = 'none';
    });

    cancelSettings.addEventListener('click', () => {
      settingsModal.style.display = 'none';
    });

    resetSettings.addEventListener('click', () => {
      if (confirm('Are you sure you want to reset all playlists? This will remove all custom playlists.')) {
        playlists = [{
          id: generateUniqueId(),
          name: DEFAULT_PLAYLIST_NAME,
          url: DEFAULT_JSON_URL
        }];
        
        activePlaylistId = playlists[0].id;
        
        localStorage.setItem('playlists', JSON.stringify(playlists));
        localStorage.setItem('activePlaylistId', activePlaylistId);
        
        renderPlaylists();
        cancelEdit(); // Reset edit form
        showNotification('Settings reset to default');
      }
    });

    addPlaylistBtn.addEventListener('click', () => {
      const name = playlistNameInput.value.trim();
      const url = jsonUrlInput.value.trim();
      
      if (!name) {
        showNotification('Please enter a playlist name');
        return;
      }
      
      if (!url) {
        showNotification('Please enter a playlist URL or file path');
        return;
      }
      
      addPlaylist(name, url);
    });
    
    // Update playlist button handler
    updatePlaylistBtn.addEventListener('click', updatePlaylist);
    
    // Cancel edit button handler
    cancelEditBtn.addEventListener('click', cancelEdit);

    saveSettings.addEventListener('click', () => {
      settingsModal.style.display = 'none';
      
      // Reload channels with new active playlist
      showNotification('Reloading channels from active playlist...');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    });

    // Mobile search functionality
    searchButtonMobile.addEventListener('click', () => {
      searchModal.classList.add('show');
      searchBarMobile.focus();
    });

    closeSearchModal.addEventListener('click', () => {
      searchModal.classList.remove('show');
    });

    // Toggle channel list for mobile
    toggleChannelList.addEventListener('click', () => {
      channelListColumn.classList.toggle('show');
      overlay.classList.toggle('show');
    });

    overlay.addEventListener('click', () => {
      channelListColumn.classList.remove('show');
      overlay.classList.remove('show');
    });

    // Create sidebar category tabs - simplified
    function createCategoryTabs() {
      const sidebarCategoryTabs = document.getElementById('sidebarCategoryTabs');
      sidebarCategoryTabs.innerHTML = '';
      
      // Add All category tab
      const allTab = document.createElement('button');
      allTab.className = 'sidebar-category-tab';
      if (currentCategory === 'all') allTab.classList.add('active');
      allTab.textContent = 'All';
      allTab.setAttribute('data-category', 'all');
      allTab.addEventListener('click', () => filterChannelsByCategory('all'));
      sidebarCategoryTabs.appendChild(allTab);
      
      // Get unique categories and add tabs
      const uniqueCategories = [...new Set(channels
        .map(channel => channel.category && channel.category.toLowerCase())
        .filter(Boolean))];
      
      uniqueCategories.forEach(category => {
        const channelWithCategory = channels.find(ch => ch.category && ch.category.toLowerCase() === category);
        const displayName = channelWithCategory ? channelWithCategory.category : category;
        
        const categoryTab = document.createElement('button');
        categoryTab.className = 'sidebar-category-tab';
        if (currentCategory === category) categoryTab.classList.add('active');
        categoryTab.textContent = displayName;
        categoryTab.setAttribute('data-category', category);
        categoryTab.addEventListener('click', () => filterChannelsByCategory(category));
        sidebarCategoryTabs.appendChild(categoryTab);
      });
    }

    // Function to filter channels by category - simplified
    function filterChannelsByCategory(category) {
      currentCategory = category;
      
      document.querySelectorAll('.sidebar-category-tab').forEach(tab => {
        tab.classList.toggle('active', tab.getAttribute('data-category') === category);
      });
      
      if (category === 'all') {
        filteredChannels = channels;
        channelListTitle.textContent = 'All Channels';
      } else {
        filteredChannels = channels.filter(channel => 
          channel.category && channel.category.toLowerCase() === category.toLowerCase()
        );
        channelListTitle.textContent = `${filteredChannels.length > 0 ? filteredChannels[0].category : category} Channels`;
      }
      
      renderChannelList();
    }

    // Function to create a channel item
    function createChannelItem(channel) {
      const item = document.createElement('div');
      item.className = 'channel-item';
      if (currentChannel && currentChannel.name === channel.name) {
        item.classList.add('active');
      }
      
      item.innerHTML = `
        <div class="channel-thumb">
          <img src="${channel.logo}" alt="${channel.name}" onerror="this.src='icon.png';">
        </div>
        <div class="channel-info">
          <div class="channel-name">${channel.name}</div>
          <div class="channel-category">${channel.category || 'Channel'}</div>
        </div>
      `;
      
      item.addEventListener('click', () => {
        playChannel(channel);
        
        document.querySelectorAll('.channel-item').forEach(ch => ch.classList.remove('active'));
        item.classList.add('active');
        
        if (window.innerWidth <= 900) {
          channelListColumn.classList.remove('show');
          overlay.classList.remove('show');
        }
      });
      
      return item;
    }

    // Function to toggle favorite status
    function toggleFavorite(channelId) {
      favorites[channelId] = !favorites[channelId];
      
      if (!favorites[channelId]) {
        delete favorites[channelId];
      }
      
      localStorage.setItem('favorites', JSON.stringify(favorites));
      
      loadFavoritesCarousel();
    }

    // Function to render channel list - simplified
    function renderChannelList(searchQuery = '') {
      channelList.innerHTML = '';
      channelList.appendChild(loadingChannels);
      loadingChannels.style.display = 'none';
      
      let displayChannels = filteredChannels;
      
      if (searchQuery) {
        displayChannels = displayChannels.filter(channel => 
          channel.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      
      if (displayChannels.length === 0) {
        channelList.innerHTML = `
          <div class="empty-state">
            <i class="fa-solid fa-tv empty-icon"></i>
            <h3 class="empty-title">No channels found</h3>
            <p class="empty-subtitle">Try searching for something else or check your connection</p>
          </div>
        `;
      } else {
        displayChannels.forEach(channel => {
          channelList.appendChild(createChannelItem(channel));
        });
      }
    }

    // Function to play a channel
    function playChannel(channel) {
      currentChannel = channel;
      
      welcomeScreen.style.display = 'none';
      playerContainer.style.display = 'block';
      playerInfo.style.display = 'block';
      playerActions.style.display = 'flex';
      
      ytChannelTitle.textContent = channel.name;
      ytChannelCategory.textContent = channel.category || 'Live TV';
      
      const isFavorite = favorites[channel.name] || false;
      ytFavoriteBtn.innerHTML = `
        <i class="fa-${isFavorite ? 'solid' : 'regular'} fa-heart"></i>
        <span>${isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}</span>
      `;
      ytFavoriteBtn.classList.toggle('active', isFavorite);
      
      const { link: streamUrl, userAgent, cookie } = channel;
      
      if (ytHls) {
        ytHls.destroy();
        ytHls = null;
      }
      
      if (ytPlayer) {
        ytPlayer.destroy();
        ytPlayer = null;
      }
      
      document.getElementById('youtubeStylePlayer').innerHTML = '';
      
      const video = document.createElement('video');
      video.id = 'ytVideoPlayer';
      video.style.width = '100%';
      video.style.height = '100%';
      // Add fade-in animation class to the video element
      video.classList.add('fade-in-animation');
      document.getElementById('youtubeStylePlayer').appendChild(video);
      
      ytPlayer = new Plyr(video, {
        controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'pip', 'settings', 'fullscreen'],
        settings: ['quality'],
        quality: { 
          default: 'Auto', 
          options: ['Auto', '1080p', '720p', '480p', '360p'], 
          forced: true,
          onChange: (quality) => {
            console.log('Quality changed to: ' + quality);
          }
        },
        fullscreen: { enabled: true, iosNative: true },
        autoplay: true,
      });
      
      ipcRenderer.send('set-headers', { userAgent, cookie });
      
      ipcRenderer.once('headers-set', () => {
        if (Hls.isSupported()) {
          ytHls = new Hls({
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
            liveSyncDuration: 3,
            liveMaxLatencyDuration: 10,
            lowLatencyMode: true,
            backBufferLength: 30,
            capLevelToPlayerSize: true,
            autoStartLoad: true
          });
          
          ytHls.loadSource(streamUrl);
          ytHls.attachMedia(video);
          
          // Setup quality switching
          ytHls.on(Hls.Events.MANIFEST_PARSED, function(event, data) {
            console.log('HLS Manifest Parsed - Quality Levels:', ytHls.levels.length);
            
            // Get available qualities
            const availableQualities = ytHls.levels.map((level, index) => {
              return {
                label: level.height ? `${level.height}p` : `${Math.round(level.bitrate/1000)} kbps`,
                value: index
              };
            }).reverse(); // Higher quality first
            
            // Debug log quality levels detected
            console.log('Available qualities:', availableQualities);
            
            // Build options array for Plyr
            const qualityOptions = availableQualities.map(q => q.label);
            qualityOptions.unshift('Auto'); // Add Auto option at beginning
            
            // Create quality switching function
            const qualitySwitcher = function(quality) {
              if (quality === 'Auto') {
                ytHls.currentLevel = -1; // Auto
                console.log('Set HLS to auto quality mode');
              } else {
                // Find the matching quality level
                const levelIndex = availableQualities.findIndex(q => q.label === quality);
                if (levelIndex > -1) {
                  ytHls.currentLevel = availableQualities[levelIndex].value;
                  console.log(`Set HLS to level: ${availableQualities[levelIndex].value} (${quality})`);
                }
              }
            };
            
            // Update Plyr's quality menu
            ytPlayer.elements.settings.quality = qualityOptions;
            
            // Directly set quality options
            if (ytPlayer.config.quality) {
              ytPlayer.config.quality.options = qualityOptions;
              ytPlayer.config.quality.forced = true;
              ytPlayer.config.quality.onChange = qualitySwitcher;
            }
            
            // Manually update quality menu
            if (ytPlayer.elements.settings.panels.quality) {
              // Force quality menu rebuild
              const qualityMenu = ytPlayer.elements.settings.panels.quality.querySelector('[role="menu"]');
              if (qualityMenu) {
                qualityMenu.innerHTML = '';
                
                qualityOptions.forEach(quality => {
                  const item = document.createElement('button');
                  item.type = 'button';
                  item.role = 'menuitemradio';
                  item.className = 'plyr__control plyr__control--forward';
                  item.value = quality;
                  item.setAttribute('data-plyr', 'quality');
                  item.textContent = quality;
                  item.setAttribute('aria-checked', quality === 'Auto' ? 'true' : 'false');
                  
                  item.addEventListener('click', () => {
                    qualitySwitcher(quality);
                    
                    // Update active state
                    qualityMenu.querySelectorAll('[role="menuitemradio"]').forEach(el => {
                      el.setAttribute('aria-checked', el.value === quality ? 'true' : 'false');
                    });
                  });
                  
                  qualityMenu.appendChild(item);
                });
              }
            }
            
            // Start playback
            ytPlayer.play().catch(error => {
              console.error('Error playing video:', error);
              showNotification('Failed to play video. Please try again.');
            });
          });
          
          ytHls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  showNotification('Network error. Attempting to reconnect...');
                  ytHls.startLoad();
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  showNotification('Media error. Attempting to recover...');
                  ytHls.recoverMediaError();
                  break;
                default:
                  showNotification('Failed to play this channel. Please try another one.');
                  ytHls.destroy();
                  break;
              }
            }
          });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = streamUrl;
          video.addEventListener('loadedmetadata', () => {
            ytPlayer.play().catch(error => {
              console.error('Error playing video:', error);
              showNotification('Failed to play video. Please try again.');
            });
          });
        } else {
          showNotification('HLS playback is not supported in your browser.');
        }
      });
    }
    
    // Load favorites carousel - simplified
    function loadFavoritesCarousel() {
      favoritesCarousel.innerHTML = '';
      
      const favoriteChannels = channels.filter(channel => favorites[channel.name]);
      
      if (favoriteChannels.length === 0) {
        favoritesCarousel.innerHTML = `
          <div style="padding: 20px; text-align: center; color: var(--text-secondary);">
            You haven't added any favorites yet. Click the heart button to add channels to your favorites.
          </div>
        `;
        return;
      }
      
      favoriteChannels.forEach(channel => {
        const item = document.createElement('div');
        item.className = 'carousel-item';
        item.innerHTML = `
          <div class="carousel-thumb">
            <img src="${channel.logo}" alt="${channel.name}" onerror="this.src='icon.png';">
          </div>
          <div class="carousel-name">${channel.name}</div>
        `;
        
        item.addEventListener('click', () => {
          playChannel(channel);
          
          document.querySelectorAll('.channel-item').forEach(ch => ch.classList.remove('active'));
          const activeItem = Array.from(document.querySelectorAll('.channel-item')).find(
            item => item.querySelector('.channel-name').textContent === channel.name
          );
          if (activeItem) activeItem.classList.add('active');
        });
        
        favoritesCarousel.appendChild(item);
      });
    }
    
    // Add event listener to favorite button
    ytFavoriteBtn.addEventListener('click', () => {
      if (!currentChannel) return;
      
      const channelName = currentChannel.name;
      toggleFavorite(channelName);
      
      const isFavorite = favorites[channelName] || false;
      ytFavoriteBtn.innerHTML = `
        <i class="fa-${isFavorite ? 'solid' : 'regular'} fa-heart"></i>
        <span>${isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}</span>
      `;
      ytFavoriteBtn.classList.toggle('active', isFavorite);
    });

    // Search functionality
    searchBar.addEventListener('input', (e) => renderChannelList(e.target.value));
    searchBarMobile.addEventListener('input', (e) => renderChannelList(e.target.value));

    // Function to fetch and display the channel list
    async function loadChannels() {
      console.log("Starting to load channels...");
      loadingChannels.style.display = 'flex';
      
      try {
        const currentJsonUrl = getActivePlaylistUrl();
        const activePlaylist = getActivePlaylist();
        console.log(`Loading channels from: ${currentJsonUrl}`);
        
        // Show active playlist name in header
        if (activePlaylist) {
          document.title = `${activePlaylist.name} - Dhara TV`;
        }
        
        let m3uContent;
        
        if (currentJsonUrl.startsWith('http://') || currentJsonUrl.startsWith('https://')) {
          const response = await fetch(currentJsonUrl);
          if (!response.ok) {
            throw new Error('Failed to fetch channels');
          }
          m3uContent = await response.text();
        } else {
          // Use ipcRenderer to read local files instead of direct Node.js fs module
          m3uContent = await new Promise((resolve, reject) => {
            ipcRenderer.once('local-file-content', (event, { content, error }) => {
              if (error) {
                reject(new Error(error));
              } else {
                resolve(content);
              }
            });
            
            ipcRenderer.send('read-local-file', { filePath: currentJsonUrl });
          });
        }
        
        channels = parseM3U(m3uContent);
        filteredChannels = channels;
        
        createCategoryTabs();
        renderChannelList();
        loadingChannels.style.display = 'none';
        loadFavoritesCarousel();
      } catch (error) {
        console.error('Error loading channels:', error);
        loadingChannels.style.display = 'none';
        
        channelList.innerHTML = `
          <div class="empty-state">
            <i class="fa-solid fa-exclamation-triangle empty-icon"></i>
            <h3 class="empty-title">Failed to load channels</h3>
            <p class="empty-subtitle">${error.message}</p>
          </div>
        `;
        
        showNotification('Failed to load channels. Check the console for details.');
      }
    }

    // Function to parse M3U playlist format - simplified
    function parseM3U(content) {
      const lines = content.split('\n').filter(line => line.trim() !== '');
      
      // Check if valid M3U
      let startIndex = 0;
      let isValid = false;
      
      for (let i = 0; i < Math.min(10, lines.length); i++) {
        const line = lines[i];
        if (line.startsWith('#EXTM3U')) {
          isValid = true;
          startIndex = i;
          break;
        } else if (line.startsWith('#EXTINF:')) {
          isValid = true;
          break;
        }
      }
      
      if (!isValid) {
        throw new Error('Invalid M3U playlist format - not a valid M3U file');
      }
      
      const channels = [];
      let currentChannel = {};
      let expectingUrl = false;
      
      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.startsWith('//') || line === '') {
          continue;
        }
        
        if (line.startsWith('#EXTINF:')) {
          currentChannel = {};
          expectingUrl = true;
          
          const groupMatch = line.match(/group-title="([^"]*)"/i);
          const logoMatch = line.match(/tvg-logo="([^"]*)"/i);
          
          const lastCommaIndex = line.lastIndexOf(',');
          if (lastCommaIndex !== -1) {
            currentChannel.name = line.substring(lastCommaIndex + 1).trim();
          } else {
            currentChannel.name = `Channel ${channels.length + 1}`;
          }
          
          currentChannel.category = groupMatch ? groupMatch[1] : null;
          currentChannel.logo = logoMatch ? logoMatch[1] : 'icon.png';
          
        } else if (line.startsWith('#EXTVLCOPT:')) {
          if (line.includes('http-user-agent=')) {
            const uaStartIndex = line.indexOf('=') + 1;
            currentChannel.userAgent = line.substring(uaStartIndex).trim();
          }
          
        } else if (line.startsWith('#EXTHTTP:')) {
          try {
            const jsonStartIndex = line.indexOf('{');
            if (jsonStartIndex !== -1) {
              const jsonStr = line.substring(jsonStartIndex);
              const httpData = JSON.parse(jsonStr);
              currentChannel.cookie = httpData.cookie || '';
            }
          } catch (e) {
            currentChannel.cookie = '';
          }
          
        } else if (!line.startsWith('#') && expectingUrl) {
          currentChannel.link = line;
          expectingUrl = false;
          
          if (currentChannel.name && currentChannel.link) {
            channels.push({...currentChannel});
          }
        }
      }
      
      return channels;
    }

    // Handle Escape key to close modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (settingsModal.style.display === 'flex') {
          closeSettingsBtn.click();
        }
        if (searchModal.classList.contains('show')) {
          closeSearchModal.click();
        }
        if (playlistSelectorModal.style.display === 'flex') {
          closePlaylistSelectorBtn.click();
        }
        if (channelListColumn.classList.contains('show')) {
          channelListColumn.classList.remove('show');
          overlay.classList.remove('show');
        }
      }
    });

    // Close modals when clicking outside
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) {
        closeSettingsBtn.click();
      }
    });

    // Responsive adjustments
    function handleResponsiveLayout() {
      toggleChannelList.style.display = window.innerWidth <= 900 ? 'flex' : 'none';
      if (window.innerWidth > 900) {
        channelListColumn.classList.remove('show');
        overlay.classList.remove('show');
      }
      
      searchButtonMobile.style.display = window.innerWidth <= 640 ? 'flex' : 'none';
      if (window.innerWidth > 640) {
        searchModal.classList.remove('show');
      }
    }

    window.addEventListener('resize', handleResponsiveLayout);
    handleResponsiveLayout();

    // Initialize the app
    loadChannels();
});