# Cross-Browser Automation Examples

## Overview

This guide shows how to use the unified browser automation system to control multiple browsers simultaneously, compare behavior across browsers, and perform cross-browser testing.

## Basic Cross-Browser Operations

### Open URL in all browsers
```
# Chrome
/browser new_tab browser:chrome url:https://sourovdeb.com

# Firefox
/browser new_tab browser:firefox url:https://sourovdeb.com

# Opera
/browser new_tab browser:opera url:https://sourovdeb.com
```

### Take screenshots from all browsers
```
# Chrome
/browser screenshot browser:chrome path:screenshots/chrome-home.png

# Firefox
/browser screenshot browser:firefox path:screenshots/firefox-home.png

# Opera
/browser screenshot browser:opera path:screenshots/opera-home.png
```

## Cross-Browser Testing

### Test form submission across browsers
```
# Define test data
SET test_url https://example.com/contact
SET test_name "Test User"
SET test_email "test@example.com"
SET test_message "This is a test message"

# Chrome
/browser navigate browser:chrome url:{test_url}
/browser wait_for_element browser:chrome selector:#contact-form timeout:5000
/browser type browser:chrome selector:#name text:{test_name}
/browser type browser:chrome selector:#email text:{test_email}
/browser type browser:chrome selector:#message text:{test_message}
/browser click browser:chrome selector:#submit-button
/browser wait_for_navigation browser:chrome timeout:10000
/browser get_page_info browser:chrome
SET chrome_result {result.title}

# Firefox
/browser navigate browser:firefox url:{test_url}
/browser wait_for_element browser:firefox selector:#contact-form timeout:5000
/browser type browser:firefox selector:#name text:{test_name}
/browser type browser:firefox selector:#email text:{test_email}
/browser type browser:firefox selector:#message text:{test_message}
/browser click browser:firefox selector:#submit-button
/browser wait_for_navigation browser:firefox timeout:10000
/browser get_page_info browser:firefox
SET firefox_result {result.title}

# Opera
/browser navigate browser:opera url:{test_url}
/browser wait_for_element browser:opera selector:#contact-form timeout:5000
/browser type browser:opera selector:#name text:{test_name}
/browser type browser:opera selector:#email text:{test_email}
/browser type browser:opera selector:#message text:{test_message}
/browser click browser:opera selector:#submit-button
/browser wait_for_navigation browser:opera timeout:10000
/browser get_page_info browser:opera
SET opera_result {result.title}

# Compare results
IF chrome_result == firefox_result == opera_result
  ECHO All browsers show the same result after form submission
ELSE
  ECHO Results differ across browsers:
  ECHO Chrome: {chrome_result}
  ECHO Firefox: {firefox_result}
  ECHO Opera: {opera_result}
ENDIF
```

## Performance Comparison

### Measure page load time
```
# Chrome
/browser navigate browser:chrome url:https://sourovdeb.com
/browser execute_js browser:chrome code:"return window.performance.timing.loadEventEnd - window.performance.timing.navigationStart"
SET chrome_load_time {result}

# Firefox
/browser navigate browser:firefox url:https://sourovdeb.com
/browser execute_js browser:firefox code:"return window.performance.timing.loadEventEnd - window.performance.timing.navigationStart"
SET firefox_load_time {result}

# Opera
/browser navigate browser:opera url:https://sourovdeb.com
/browser execute_js browser:opera code:"return window.performance.timing.loadEventEnd - window.performance.timing.navigationStart"
SET opera_load_time {result}

# Compare
ECHO Chrome load time: {chrome_load_time}ms
ECHO Firefox load time: {firefox_load_time}ms
ECHO Opera load time: {opera_load_time}ms
```

### Memory usage comparison
```powershell
# Get initial memory
Get-CimInstance Win32_OperatingSystem | Select-Object FreePhysicalMemory
SET initial_memory {result.FreePhysicalMemory}

# Start Chrome
Start-Process 'C:\Program Files\Google\Chrome\Application\chrome.exe' -ArgumentList '--remote-debugging-port=9222','--user-data-dir=C:\Users\souro\AppData\Local\Google\Chrome\DebugFull'
Start-Sleep -Seconds 5
Get-CimInstance Win32_OperatingSystem | Select-Object FreePhysicalMemory
SET after_chrome {result.FreePhysicalMemory}

# Start Firefox
geckodriver --port=4444
Start-Process 'C:\Program Files\Mozilla Firefox\firefox.exe'
Start-Sleep -Seconds 5
Get-CimInstance Win32_OperatingSystem | Select-Object FreePhysicalMemory
SET after_firefox {result.FreePhysicalMemory}

# Start Opera
Start-Process 'C:\Program Files\Opera\launcher.exe' -ArgumentList '--remote-debugging-port=9223'
Start-Sleep -Seconds 5
Get-CimInstance Win32_OperatingSystem | Select-Object FreePhysicalMemory
SET after_opera {result.FreePhysicalMemory}

# Calculate memory usage
SET chrome_memory {initial_memory} - {after_chrome}
SET firefox_memory {after_chrome} - {after_firefox}
SET opera_memory {after_firefox} - {after_opera}

ECHO Chrome memory usage: {chrome_memory / 1MB} MB
ECHO Firefox memory usage: {firefox_memory / 1MB} MB
ECHO Opera memory usage: {opera_memory / 1MB} MB
```

## Visual Regression Testing

### Take screenshots and compare
```
# Define test pages
SET pages ["https://sourovdeb.com", "https://sourovdeb.com/about", "https://sourovdeb.com/contact"]

# For each page
FOREACH page IN {pages}
  # Extract domain for filename
  SET filename {page.Replace("https://", "").Replace("/", "-")}
  
  # Chrome
  /browser navigate browser:chrome url:{page}
  /browser wait_for_navigation browser:chrome timeout:5000
  /browser screenshot browser:chrome path:screenshots/chrome-{filename}.png
  
  # Firefox
  /browser navigate browser:firefox url:{page}
  /browser wait_for_navigation browser:firefox timeout:5000
  /browser screenshot browser:firefox path:screenshots/firefox-{filename}.png
  
  # Opera
  /browser navigate browser:opera url:{page}
  /browser wait_for_navigation browser:opera timeout:5000
  /browser screenshot browser:opera path:screenshots/opera-{filename}.png
ENDFOR

# Now compare screenshots (manual or automated comparison)
ECHO Screenshots saved to screenshots/ directory
ECHO Use image comparison tool to check for visual differences
```

## CSS Compatibility Testing

### Check CSS support across browsers
```
# Define CSS properties to test
SET css_tests [
  "display: grid",
  "gap: 10px",
  "aspect-ratio: 16/9",
  "backdrop-filter: blur(10px)"
]

# For each CSS test
FOREACH css IN {css_tests}
  /browser new_tab browser:chrome url:data:text/html,<html><style>div {{css}};background:red;</style><div>Test</div></html>
  /browser wait_for_navigation browser:chrome timeout:2000
  /browser execute_js browser:chrome code:"return window.getComputedStyle(document.querySelector('div')).backgroundColor"
  SET chrome_css {result}
  
  /browser new_tab browser:firefox url:data:text/html,<html><style>div {{css}};background:red;</style><div>Test</div></html>
  /browser wait_for_navigation browser:firefox timeout:2000
  /browser execute_js browser:firefox code:"return window.getComputedStyle(document.querySelector('div')).backgroundColor"
  SET firefox_css {result}
  
  /browser new_tab browser:opera url:data:text/html,<html><style>div {{css}};background:red;</style><div>Test</div></html>
  /browser wait_for_navigation browser:opera timeout:2000
  /browser execute_js browser:opera code:"return window.getComputedStyle(document.querySelector('div')).backgroundColor"
  SET opera_css {result}
  
  IF chrome_css == "rgb(255, 0, 0)" AND firefox_css == "rgb(255, 0, 0)" AND opera_css == "rgb(255, 0, 0)"
    ECHO {css} - Supported in all browsers ✓
  ELSE
    ECHO {css} - NOT supported in all browsers
    ECHO Chrome: {chrome_css}
    ECHO Firefox: {firefox_css}
    ECHO Opera: {opera_css}
  ENDIF
  
  # Close tabs
  /browser close_tab browser:chrome tab_id:{tab_id}
  /browser close_tab browser:firefox tab_id:{tab_id}
  /browser close_tab browser:opera tab_id:{tab_id}
ENDFOR
```

## JavaScript Compatibility Testing

### Test JavaScript features
```
# Define JavaScript features to test
SET js_tests [
  "return 'ES6' in String(Object.fromEntries)",
  "return 'arrowFunction' in (() => {})",
  "return new Promise(() => {}).constructor.name === 'Promise'",
  "return [1,2,3].includes(2)"
]

# For each test
FOREACH js IN {js_tests}
  /browser execute_js browser:chrome code:{js}
  SET chrome_js {result}
  
  /browser execute_js browser:firefox code:{js}
  SET firefox_js {result}
  
  /browser execute_js browser:opera code:{js}
  SET opera_js {result}
  
  IF chrome_js == true AND firefox_js == true AND opera_js == true
    ECHO Feature supported in all browsers ✓
  ELSE
    ECHO Feature NOT supported in all browsers
    ECHO Chrome: {chrome_js}
    ECHO Firefox: {firefox_js}
    ECHO Opera: {opera_js}
  ENDIF
ENDFOR
```

## Form Testing Across Browsers

### Test form validation
```
# Define test form data
SET test_cases [
  {email: "", password: "", expected: "Validation error"},
  {email: "invalid", password: "short", expected: "Validation error"},
  {email: "valid@example.com", password: "ValidPass123", expected: "Success"}
]

# For each test case
FOREACH test IN {test_cases}
  # Chrome
  /browser navigate browser:chrome url:https://example.com/register
  /browser wait_for_element browser:chrome selector:#registration-form timeout:5000
  /browser clear browser:chrome selector:#email
  /browser clear browser:chrome selector:#password
  /browser type browser:chrome selector:#email text:{test.email}
  /browser type browser:chrome selector:#password text:{test.password}
  /browser click browser:chrome selector:#submit-button
  /browser wait_for_navigation browser:chrome timeout:5000
  /browser execute_js browser:chrome code:"return document.querySelector('.error-message') ? 'Validation error' : 'Success'"
  SET chrome_result {result}
  
  # Firefox
  /browser navigate browser:firefox url:https://example.com/register
  /browser wait_for_element browser:firefox selector:#registration-form timeout:5000
  /browser clear browser:firefox selector:#email
  /browser clear browser:firefox selector:#password
  /browser type browser:firefox selector:#email text:{test.email}
  /browser type browser:firefox selector:#password text:{test.password}
  /browser click browser:firefox selector:#submit-button
  /browser wait_for_navigation browser:firefox timeout:5000
  /browser execute_js browser:firefox code:"return document.querySelector('.error-message') ? 'Validation error' : 'Success'"
  SET firefox_result {result}
  
  # Opera
  /browser navigate browser:opera url:https://example.com/register
  /browser wait_for_element browser:opera selector:#registration-form timeout:5000
  /browser clear browser:opera selector:#email
  /browser clear browser:opera selector:#password
  /browser type browser:opera selector:#email text:{test.email}
  /browser type browser:opera selector:#password text:{test.password}
  /browser click browser:opera selector:#submit-button
  /browser wait_for_navigation browser:opera timeout:5000
  /browser execute_js browser:opera code:"return document.querySelector('.error-message') ? 'Validation error' : 'Success'"
  SET opera_result {result}
  
  IF chrome_result == {test.expected} AND firefox_result == {test.expected} AND opera_result == {test.expected}
    ECHO Test passed: All browsers show {test.expected} ✓
  ELSE
    ECHO Test FAILED for {test.email} / {test.password}
    ECHO Chrome: {chrome_result} (expected: {test.expected})
    ECHO Firefox: {firefox_result} (expected: {test.expected})
    ECHO Opera: {opera_result} (expected: {test.expected})
  ENDIF
ENDFOR
```

## Automated Testing Workflow

### Full cross-browser test suite
```
# 1. Start all services
/browser new_tab browser:chrome url:http://localhost:3001/health
/browser new_tab browser:firefox url:http://localhost:3003/health
/browser new_tab browser:opera url:http://localhost:3002/health

# 2. Verify all browsers are running
/browser list_tabs browser:chrome
/browser list_tabs browser:firefox
/browser list_tabs browser:opera

# 3. Run navigation tests
/browser navigate browser:chrome url:https://sourovdeb.com
/browser get_page_info browser:chrome
SET chrome_page {result}

/browser navigate browser:firefox url:https://sourovdeb.com
/browser get_page_info browser:firefox
SET firefox_page {result}

/browser navigate browser:opera url:https://sourovdeb.com
/browser get_page_info browser:opera
SET opera_page {result}

# 4. Run interaction tests
/browser click browser:chrome selector:a
/browser get_page_info browser:chrome
SET chrome_after_click {result}

/browser click browser:firefox selector:a
/browser get_page_info browser:firefox
SET firefox_after_click {result}

/browser click browser:opera selector:a
/browser get_page_info browser:opera
SET opera_after_click {result}

# 5. Generate test report
ECHO === Cross-Browser Test Report ===
ECHO Date: {new Date().toISOString()}
ECHO 
ECHO Navigation Tests:
ECHO Chrome: {chrome_page.title} - {chrome_page.url}
ECHO Firefox: {firefox_page.title} - {firefox_page.url}
ECHO Opera: {opera_page.title} - {opera_page.url}
ECHO 
ECHO Interaction Tests:
ECHO Chrome after click: {chrome_after_click.title}
ECHO Firefox after click: {firefox_after_click.title}
ECHO Opera after click: {opera_after_click.title}
ECHO 
IF chrome_page.title == firefox_page.title == opera_page.title
  ECHO ✓ All browsers show consistent page titles
ELSE
  ECHO ✗ Page titles differ across browsers
ENDIF
```

## RAM-Conscious Cross-Browser Testing

### Memory-efficient testing
```
# Instead of running all tests sequentially (memory-heavy)
# Run tests in batches with cleanup

# Batch 1: Chrome tests
/browser new_tab browser:chrome url:https://sourovdeb.com
# ... run Chrome tests ...
/browser close_all_tabs browser:chrome

# Batch 2: Firefox tests
/browser new_tab browser:firefox url:https://sourovdeb.com
# ... run Firefox tests ...
/browser close_all_tabs browser:firefox

# Batch 3: Opera tests
/browser new_tab browser:opera url:https://sourovdeb.com
# ... run Opera tests ...
/browser close_all_tabs browser:opera

# This way, only one browser is running at a time
```

### Check memory before each test
```powershell
# Before starting Chrome
Get-CimInstance Win32_OperatingSystem | Select-Object FreePhysicalMemory
IF {result.FreePhysicalMemory} < 3GB
  ECHO Warning: Low memory, skipping Chrome tests
ELSE
  # Start Chrome and run tests
ENDIF
```

## Tips for Cross-Browser Automation

### 1. Use consistent selectors
```
# Same selector works across browsers
/browser click browser:chrome selector:#submit
/browser click browser:firefox selector:#submit
/browser click browser:opera selector:#submit
```

### 2. Add browser-specific fallbacks
```
# Try different selectors for different browsers
/browser click browser:chrome selector:#chrome-specific-button
/browser click browser:firefox selector:#firefox-specific-button
/browser click browser:opera selector:#opera-specific-button
```

### 3. Handle browser differences
```
# Check browser type and adjust behavior
/browser execute_js browser:chrome code:"return navigator.userAgent"
SET user_agent {result}

IF user_agent.Contains("Chrome")
  /browser click browser:chrome selector:.chrome-selector
ELSEIF user_agent.Contains("Firefox")
  /browser click browser:firefox selector:.firefox-selector
ELSEIF user_agent.Contains("Opera")
  /browser click browser:opera selector:.opera-selector
ENDIF
```

### 4. Use feature detection
```
# Check if feature is available before using it
/browser execute_js browser:chrome code:"return 'serviceWorker' in navigator"
IF {result} == true
  /browser execute_js browser:chrome code:"navigator.serviceWorker.register('/sw.js')"
ENDIF
```

### 5. Synchronize actions across browsers
```
# Open same URL in all browsers at once
/browser new_tab browser:chrome url:https://sourovdeb.com
/browser new_tab browser:firefox url:https://sourovdeb.com
/browser new_tab browser:opera url:https://sourovdeb.com

# Wait for all to load
/browser wait_for_navigation browser:chrome timeout:5000
/browser wait_for_navigation browser:firefox timeout:5000
/browser wait_for_navigation browser:opera timeout:5000
```
