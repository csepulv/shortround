import { TextField } from '@mui/material';
import getCaretCoordinates from 'textarea-caret';
import * as Popover from '@radix-ui/react-popover';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

function useCaretPosition(textareaRef) {
  const [coords, setCoords] = useState(null);

  const update = useCallback(() => {
    if (!textareaRef.current) return;
    const pos = textareaRef.current.selectionStart || 0;
    const { top, left, height } = getCaretCoordinates(textareaRef.current, pos);
    const box = textareaRef.current.getBoundingClientRect();
    setCoords({
      x: box.left + left,
      y: box.top + top + height
    });
  }, [textareaRef]);

  useLayoutEffect(() => {
    update(); // run once on mount
    const el = textareaRef.current;
    if (!el) return;
    el.addEventListener('keyup', update);
    el.addEventListener('click', update);
    el.addEventListener('scroll', update); // keep in sync when scrolling
    return () => {
      el.removeEventListener('keyup', update);
      el.removeEventListener('click', update);
      el.removeEventListener('scroll', update);
    };
  }, [update]);

  return coords;
}

function useVirtualElement(coords) {
  return useMemo(() => {
    if (!coords) return null;
    return {
      getBoundingClientRect: () => new DOMRect(coords.x, coords.y, 0, 0)
    };
  }, [coords]);
}

export default function CaretDropdown() {
  const textareaRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');

  const caretCoords = useCaretPosition(textareaRef);
  const virtualEl = useVirtualElement(caretCoords);

  const close = () => {
    setOpen(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      console.log('opening');
      e.preventDefault();
      setOpen(true);
    } else if (e.key === 'Escape') {
      console.log('closing');
      close();
    }
  };

  return (
    <>
      <Popover.Root open={true} onOpenChange={setOpen} modal={false}>
        <Popover.Trigger asChild>
          <TextField
            autoFocus
            inputRef={textareaRef}
            sx={{ width: 600 }}
            label="Intention ..."
            multiline
            rows={4}
            onKeyDown={handleKeyDown}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </Popover.Trigger>

        {virtualEl && <Popover.Anchor virtualRef={virtualEl} />}

        <Popover.Portal>
          <Popover.Content
            sideOffset={4}
            align="start"
            onEscapeKeyDown={close}
            onPointerDownOutside={close}
          >
            <DropdownMenu.Root defaultOpen>
              <DropdownMenu.Content
                onEscapeKeyDown={close}
                onBlurCapture={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) close();
                }}
              >
                <DropdownMenu.Item
                  onSelect={() => {
                    console.log('First');
                    close();
                  }}
                >
                  First action
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={() => {
                    console.log('Second');
                    close();
                  }}
                >
                  Second action
                </DropdownMenu.Item>
                <DropdownMenu.Separator />
                <DropdownMenu.Item disabled>Edit…</DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </>
  );
}
