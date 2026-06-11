# Simple template

The Simple Editor Template is a fully working setup for the Tiptap editor. It includes commonly used open source extensions and UI components, all MIT licensed and ready to customize.

[

View in Full Screen

](https://template.tiptap.dev/preview/templates/simple)

## [](#installation)Installation

### [](#for-existing-projects)For existing projects

```
npx @tiptap/cli@latest add simple-editor
```

### [](#for-new-projects)For new projects

```
npx @tiptap/cli@latest init simple-editor
```

## [](#styling)Styling

This template requires styling setup. We stay unopinionated about styling frameworks, so you'll need to integrate it with your setup. Follow the [style setup guide](/docs/ui-components/getting-started/style) to ensure the editor displays correctly.

## [](#usage)Usage

After installation, use the SimpleEditor component in your React or Next.js project:

```
import { SimpleEditor } from '@/components/tiptap-templates/simple/simple-editor'

export default function App() {
  return <SimpleEditor />
}
```

## [](#features)Features

A fully responsive rich text editor with built-in support for common formatting and layout tools. All components are open source and easy to extend.

-   **Responsive design**: Mobile-friendly by default
-   **Dark and light mode**: Supported out-of-the-box
-   **Formatting**: Bold, Italic, Underline
-   **Lists**: Bullet, Ordered, Checkboxes
-   **Text alignment**: Left, Center, Right, Justified
-   **Headings**: Multiple levels via dropdown
-   **Image upload**
-   **Link editing:** UI for adding and editing links
-   **Undo / Redo:** History management

### [](#used-reference-components)Used reference components

#### [](#hooks)Hooks

-   `use-mobile`
-   `use-window-size`

#### [](#icons)Icons

-   `arrow-left-icon`
-   `highlighter-icon`
-   `link-icon`
-   `moon-star-icon`
-   `sun-icon`

#### [](#extensions)Extensions

-   `selection-extension`
-   `link-extension`
-   `trailing-node-extension`

#### [](#lib)Lib

-   `tiptap-utils`

#### [](#ui-components)UI Components

-   `blockquote-button`
-   `code-block-button`
-   `color-highlight-button`
-   `color-highlight-popover`
-   `heading-button`
-   `heading-dropdown-menu`
-   `image-upload-button`
-   `link-popover`
-   `list-button`
-   `list-dropdown-menu`
-   `mark-button`
-   `text-align-button`
-   `undo-redo-button`

#### [](#node-components)Node Components

-   `code-block-node`
-   `image-node`
-   `image-upload-node`
-   `list-node`
-   `paragraph-node`

#### [](#primitives)Primitives

-   `button`
-   `spacer`
-   `toolbar`

## [](#license)License

The Simple Editor Template and all included components are MIT licensed. You’re free to use, modify, and extend the code as needed.

## [](#future-compatibility)Future compatibility

You can extend this template with additional features as your needs grow.

Paid Tiptap Cloud features will have matching UI components that integrate just as easily! No rework needed.