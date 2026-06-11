"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { debounce } from "es-toolkit"
import { EditorContent, EditorContext, useEditor } from "@tiptap/react"

// --- Tiptap Core Extensions ---
import { StarterKit } from "@tiptap/starter-kit"
import { Image } from "@tiptap/extension-image"
import { TaskItem, TaskList } from "@tiptap/extension-list"
import { TextAlign } from "@tiptap/extension-text-align"
import { Typography } from "@tiptap/extension-typography"
import { Highlight } from "@tiptap/extension-highlight"
import { Subscript } from "@tiptap/extension-subscript"
import { Superscript } from "@tiptap/extension-superscript"
import { Selection } from "@tiptap/extensions"

// --- UI Primitives ---
import { Spacer } from "@/components/tiptap-ui-primitive/spacer"
import {
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator,
} from "@/components/tiptap-ui-primitive/toolbar"

// --- Tiptap Node styles (no image-upload-node — it's disabled) ---
import { HorizontalRule } from "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension"
import "@/components/tiptap-node/blockquote-node/blockquote-node.scss"
import "@/components/tiptap-node/code-block-node/code-block-node.scss"
import "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss"
import "@/components/tiptap-node/list-node/list-node.scss"
import "@/components/tiptap-node/image-node/image-node.scss"
import "@/components/tiptap-node/heading-node/heading-node.scss"
import "@/components/tiptap-node/paragraph-node/paragraph-node.scss"

// --- Tiptap UI ---
import { HeadingDropdownMenu } from "@/components/tiptap-ui/heading-dropdown-menu"
import { ListDropdownMenu } from "@/components/tiptap-ui/list-dropdown-menu"
import { BlockquoteButton } from "@/components/tiptap-ui/blockquote-button"
import { CodeBlockButton } from "@/components/tiptap-ui/code-block-button"
import {
  ColorHighlightPopover,
  ColorHighlightPopoverContent,
  ColorHighlightPopoverButton,
} from "@/components/tiptap-ui/color-highlight-popover"
import {
  LinkPopover,
  LinkContent,
  LinkButton,
} from "@/components/tiptap-ui/link-popover"
import { MarkButton } from "@/components/tiptap-ui/mark-button"
import { TextAlignButton } from "@/components/tiptap-ui/text-align-button"
import { UndoRedoButton } from "@/components/tiptap-ui/undo-redo-button"

// --- Icons ---
import { ArrowLeftIcon } from "@/components/tiptap-icons/arrow-left-icon"
import { HighlighterIcon } from "@/components/tiptap-icons/highlighter-icon"
import { LinkIcon } from "@/components/tiptap-icons/link-icon"

// --- Hooks ---
import { useIsBreakpoint } from "@/hooks/use-is-breakpoint"
import { useCursorVisibility } from "@/hooks/use-cursor-visibility"

// --- Button primitive ---
import { Button } from "@/components/tiptap-ui-primitive/button"

// --- Schema contract ---
import type { FieldComponentProps } from "@/lib/schema"

// --- Field-scoped styles ---
import "./rich-text-field.scss"

// ---------------------------------------------------------------------------
// Toolbar sub-components (mirrors simple-editor without image upload / theme)
// ---------------------------------------------------------------------------

const MainToolbarContent = ({
  onHighlighterClick,
  onLinkClick,
  isMobile,
}: {
  onHighlighterClick: () => void
  onLinkClick: () => void
  isMobile: boolean
}) => (
  <>
    <Spacer />

    <ToolbarGroup>
      <UndoRedoButton action="undo" />
      <UndoRedoButton action="redo" />
    </ToolbarGroup>

    <ToolbarSeparator />

    <ToolbarGroup>
      <HeadingDropdownMenu modal={false} levels={[1, 2, 3, 4]} />
      <ListDropdownMenu
        modal={false}
        types={["bulletList", "orderedList", "taskList"]}
      />
      <BlockquoteButton />
      <CodeBlockButton />
    </ToolbarGroup>

    <ToolbarSeparator />

    <ToolbarGroup>
      <MarkButton type="bold" />
      <MarkButton type="italic" />
      <MarkButton type="strike" />
      <MarkButton type="code" />
      <MarkButton type="underline" />
      {!isMobile ? (
        <ColorHighlightPopover />
      ) : (
        <ColorHighlightPopoverButton onClick={onHighlighterClick} />
      )}
      {!isMobile ? <LinkPopover /> : <LinkButton onClick={onLinkClick} />}
    </ToolbarGroup>

    <ToolbarSeparator />

    <ToolbarGroup>
      <MarkButton type="superscript" />
      <MarkButton type="subscript" />
    </ToolbarGroup>

    <ToolbarSeparator />

    <ToolbarGroup>
      <TextAlignButton align="left" />
      <TextAlignButton align="center" />
      <TextAlignButton align="right" />
      <TextAlignButton align="justify" />
    </ToolbarGroup>

    <Spacer />
  </>
)

const MobileToolbarContent = ({
  type,
  onBack,
}: {
  type: "highlighter" | "link"
  onBack: () => void
}) => (
  <>
    <ToolbarGroup>
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeftIcon className="tiptap-button-icon" />
        {type === "highlighter" ? (
          <HighlighterIcon className="tiptap-button-icon" />
        ) : (
          <LinkIcon className="tiptap-button-icon" />
        )}
      </Button>
    </ToolbarGroup>

    <ToolbarSeparator />

    {type === "highlighter" ? <ColorHighlightPopoverContent /> : <LinkContent />}
  </>
)

// ---------------------------------------------------------------------------
// RichTextField — the exported form field component
// ---------------------------------------------------------------------------

export function RichTextField({ field, def }: FieldComponentProps) {
  const isMobile = useIsBreakpoint()
  // Tracks which toolbar panel the user opened on mobile (highlighter / link / main).
  // On desktop we always derive "main" directly so no effect is needed to reset it.
  const [mobileToolbarView, setMobileView] = useState<"main" | "highlighter" | "link">(
    "main"
  )
  const mobileView = isMobile ? mobileToolbarView : "main"
  const toolbarRef = useRef<HTMLDivElement>(null)

  // Capture the initial value once so we never re-inject into the editor.
  // Using a ref avoids the effect-on-every-render footgun.
  const initialContentRef = useRef<string>(
    typeof field.value === "string" ? field.value : ""
  )

  // Debounce RHF updates — trailing 250 ms so we don't push an HTML snapshot
  // on every keystroke. Stable across renders via useMemo; cancelled on unmount.
  const debouncedOnChange = useMemo(
    () => debounce((html: string) => field.onChange(html), 250),
    // field is stable for the lifetime of the RHF controller, so this memo
    // never re-creates — safe to disable the exhaustive-deps warning here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  // Cancel any pending debounced call when the component unmounts to avoid
  // calling into an already-torn-down RHF controller.
  useEffect(() => () => debouncedOnChange.cancel(), [debouncedOnChange])

  // eslint-disable-next-line react-hooks/refs
  const editor = useEditor({
    immediatelyRender: false,
    editorProps: {
      attributes: {
        autocomplete: "off",
        autocorrect: "off",
        autocapitalize: "off",
        "aria-label": def.label
          ? `${def.label} rich text editor`
          : "Rich text editor",
        // scoped class keeps our SCSS from leaking into the global simple-editor styles
        class: "rte-field-editor",
      },
    },
    extensions: [
      StarterKit.configure({
        horizontalRule: false,
        link: {
          openOnClick: false,
          enableClickSelection: true,
        },
      }),
      HorizontalRule,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      // Image is kept for paste/drop of already-hosted images; the upload
      // button is intentionally omitted from the toolbar, so there is no UI
      // path to trigger a local-file upload.
      Image,
      Typography,
      Superscript,
      Subscript,
      Selection,
      // ImageUploadNode is intentionally NOT included — no upload backend.
    ],
    // eslint-disable-next-line react-hooks/refs
    content: initialContentRef.current || undefined,
    onUpdate: ({ editor: e }) => {
      debouncedOnChange(e.getHTML())
    },
    onBlur: ({ editor: e }) => {
      // Flush any pending debounced update immediately so RHF sees the final
      // value before validation runs on blur.
      debouncedOnChange.flush()
      debouncedOnChange(e.getHTML())
      field.onBlur()
    },
  })

  const rect = useCursorVisibility({
    editor,
    // eslint-disable-next-line react-hooks/refs
    overlayHeight: toolbarRef.current?.getBoundingClientRect().height ?? 0,
  })

  return (
    <div className="rte-field-wrapper tiptap-editor-scope">
      <EditorContext.Provider value={{ editor }}>
        <Toolbar
          ref={toolbarRef}
          style={
            isMobile
              ? { bottom: `calc(100% - ${rect.y}px)` }
              : undefined
          }
          className="rte-field-toolbar"
        >
          {mobileView === "main" ? (
            <MainToolbarContent
              onHighlighterClick={() => setMobileView("highlighter")}
              onLinkClick={() => setMobileView("link")}
              isMobile={isMobile}
            />
          ) : (
            <MobileToolbarContent
              type={mobileView === "highlighter" ? "highlighter" : "link"}
              onBack={() => setMobileView("main")}
            />
          )}
        </Toolbar>

        <EditorContent
          editor={editor}
          role="presentation"
          className="rte-field-content"
        />
      </EditorContext.Provider>
    </div>
  )
}
