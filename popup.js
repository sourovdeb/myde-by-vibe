document.addEventListener('DOMContentLoaded', function() {
  const tabsList = document.getElementById('tabsList');
  const statusDiv = document.getElementById('status');
  const refreshBtn = document.getElementById('refreshBtn');

  function updateTabsDisplay(tabs) {
    if (!tabs || tabs.length === 0) {
      statusDiv.textContent = 'No tabs open';
      tabsList.innerHTML = '<div class="tab-item">No tabs found</div>';
      return;
    }

    statusDiv.textContent = tabs.length + ' tab(s) open';
    tabsList.innerHTML = '';
    
    tabs.forEach(tab => {
      const tabItem = document.createElement('div');
      tabItem.className = 'tab-item' + (tab.active ? ' active' : '');
      
      const titleDiv = document.createElement('div');
      titleDiv.className = 'tab-title';
      titleDiv.textContent = tab.title || '(No title)';
      
      const urlDiv = document.createElement('div');
      urlDiv.className = 'tab-url';
      urlDiv.textContent = tab.url || '';
      
      tabItem.appendChild(titleDiv);
      tabItem.appendChild(urlDiv);
      
      tabItem.addEventListener('click', () => {
        chrome.tabs.update(tab.id, { active: true });
        window.close();
      });
      
      tabsList.appendChild(tabItem);
    });
  }

  function getTabs() {
    chrome.tabs.query({}, function(tabs) {
      updateTabsDisplay(tabs);
    });
  }

  getTabs();
  refreshBtn.addEventListener('click', getTabs);
  setInterval(getTabs, 2000);
});
