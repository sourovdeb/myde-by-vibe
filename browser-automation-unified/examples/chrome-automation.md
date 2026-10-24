# Chrome Automation Examples

## Basic Navigation

### Open a URL
```
/browser new_tab browser:chrome url:https://sourovdeb.com
```

### Navigate to a page
```
/browser navigate browser:chrome url:https://sourovdeb.com/about
```

### Refresh the page
```
/browser refresh browser:chrome
```

### Go back and forward
```
/browser go_back browser:chrome
/browser go_forward browser:chrome
```

## Tab Management

### List all tabs
```
/browser list_tabs browser:chrome
```

### Switch to a specific tab
```
/browser switch_tab browser:chrome tab_id:3
```

### Close a tab
```
/browser close_tab browser:chrome tab_id:5
```

### Close all tabs
```
/browser close_all_tabs browser:chrome
```

## Page Interaction

### Click an element
```
/browser click browser:chrome selector:#submit-button
```

### Click at specific coordinates
```
/browser click_at_xy browser:chrome x:100 y:200
```

### Type text into an element
```
/browser type browser:chrome selector:#username text:myusername
```

### Clear an element
```
/browser clear browser:chrome selector:#search-input
```

### Scroll the page
```
/browser scroll browser:chrome direction:down pixels:500
```

### Scroll to an element
```
/browser scroll_to_element browser:chrome selector:#footer
```

## Data Extraction

### Get page information
```
/browser get_page_info browser:chrome
```

### Get full page HTML
```
/browser get_dom browser:chrome
```

### Get element text
```
/browser get_element_text browser:chrome selector:h1
```

### Get element attribute
```
/browser get_element_attribute browser:chrome selector:img logo src
```

### Take a screenshot
```
/browser screenshot browser:chrome path:screenshot.png
```

### Take screenshot of specific element
```
/browser screenshot_element browser:chrome selector:.hero-section path:hero.png
```

## JavaScript Execution

### Execute simple code
```
/browser execute_js browser:chrome code:"return document.title"
```

### Execute code from file
```
/browser execute_js_file browser:chrome file_path:script.js
```

### Get all links on page
```
/browser execute_js browser:chrome code:"return Array.from(document.querySelectorAll('a[href]')).map(a => ({text: a.textContent, href: a.href}))"
```

## Waiting and Timing

### Wait for element to appear
```
/browser wait_for_element browser:chrome selector:.loaded timeout:5000
```

### Wait for navigation
```
/browser wait_for_navigation browser:chrome timeout:10000
```

### Sleep
```
/browser sleep browser:chrome milliseconds:2000
```

## Advanced Interactions

### Handle dialogs
```
/browser handle_dialog browser:chrome accept:true text:OK
```

### Press a key
```
/browser press_key browser:chrome key:Enter
```

### Upload a file
```
/browser upload_file browser:chrome selector:#file-upload file_path:C:\path\to\file.txt
```

### Download a file
```
/browser download_file browser:chrome url:https://example.com/file.pdf path:C:\downloads\file.pdf
```

## Real-World Workflows

### Login to a website
```
# Navigate to login page
/browser navigate browser:chrome url:https://example.com/login

# Wait for page to load
/browser wait_for_element browser:chrome selector:#username timeout:5000

# Fill username
/browser type browser:chrome selector:#username text:myuser

# Fill password
/browser type browser:chrome selector:#password text:mypassword

# Click login button
/browser click browser:chrome selector:#login-button

# Wait for login to complete
/browser wait_for_navigation browser:chrome timeout:10000
```

### Scrape data from a page
```
# Navigate to page
/browser navigate browser:chrome url:https://example.com/products

# Wait for products to load
/browser wait_for_element browser:chrome selector:.product timeout:5000

# Extract product data
/browser execute_js browser:chrome code:"
  return Array.from(document.querySelectorAll('.product')).map(p => ({
    name: p.querySelector('.name').textContent,
    price: p.querySelector('.price').textContent,
    description: p.querySelector('.description').textContent
  }))
"
```

### Fill a form
```
# Navigate to form
/browser navigate browser:chrome url:https://example.com/contact

# Wait for form to load
/browser wait_for_element browser:chrome selector:#contact-form timeout:5000

# Fill form fields
/browser type browser:chrome selector:#name text:John Doe
/browser type browser:chrome selector:#email text:john@example.com
/browser type browser:chrome selector:#message text:Hello, this is a test message

# Submit form
/browser click browser:chrome selector:#submit-button

# Wait for submission
/browser wait_for_navigation browser:chrome timeout:10000
```

### Take multiple screenshots
```
# Navigate to pages
/browser navigate browser:chrome url:https://example.com/page1
/browser screenshot browser:chrome path:page1.png

/browser navigate browser:chrome url:https://example.com/page2
/browser screenshot browser:chrome path:page2.png

/browser navigate browser:chrome url:https://example.com/page3
/browser screenshot browser:chrome path:page3.png
```

## Testing WordPress Admin

### Login to WordPress
```
# Navigate to WordPress login
/browser new_tab browser:chrome url:https://sourovdeb.com/wp-login.php

# Wait for page to load
/browser wait_for_element browser:chrome selector:#user_login timeout:5000

# Fill username
/browser type browser:chrome selector:#user_login text:admin

# Fill password
/browser type browser:chrome selector:#user_pass text:application_password

# Click login
/browser click browser:chrome selector:#wp-submit

# Wait for login
/browser wait_for_navigation browser:chrome timeout:10000
```

### Navigate WordPress admin
```
# Go to posts
/browser navigate browser:chrome url:https://sourovdeb.com/wp-admin/edit.php

# Click "Add New"
/browser click browser:chrome selector:.page-title-action

# Wait for editor
/browser wait_for_element browser:chrome selector:#title timeout:5000

# Fill post title
/browser type browser:chrome selector:#title text:My New Post

# Fill content (using JS since editor is complex)
/browser execute_js browser:chrome code:"
  const editor = document.querySelector('#content-ifr');
  if (editor) {
    editor.contentDocument.body.innerHTML = '<p>This is my new post content.</p>';
  }
"

# Click publish
/browser click browser:chrome selector:#publish
```

## Performance Tips

### Efficient selectors
```
# Good: Use IDs
/browser click browser:chrome selector:#submit

# Good: Use classes
/browser click browser:chrome selector:.button.primary

# Good: Use data attributes
/browser click browser:chrome selector:[data-action="submit"]

# Bad: Complex traversals
/browser click browser:chrome selector:div > div > div > button

# Bad: Position-based
/browser click browser:chrome selector:div:nth-child(3) > button:last-child
```

### Wait for elements
```
# Always wait before interacting
/browser wait_for_element browser:chrome selector:.loaded timeout:5000
/browser click browser:chrome selector:.loaded

# Instead of:
/browser click browser:chrome selector:.loaded
# (might fail if element not there yet)
```

### Reuse tabs
```
# Store tab ID for reuse
SET tab_id 5

# Use stored tab ID
/browser switch_tab browser:chrome tab_id:{tab_id}
/browser click browser:chrome selector:#button

# Instead of opening new tabs for each action
```

## Error Handling

### Check if element exists
```
/browser execute_js browser:chrome code:"return document.querySelector('.my-element') ? true : false"
```

### Try-catch pattern
```
# Check if element exists before clicking
/browser execute_js browser:chrome code:"return document.querySelector('#my-button') ? 'exists' : 'missing'"
IF result == exists
  /browser click browser:chrome selector:#my-button
ELSE
  # Handle missing element
ENDIF
```

### Get error information
```
/browser execute_js browser:chrome code:"return {title: document.title, url: window.location.href, hasError: document.querySelector('.error') ? true : false}"
```
