import { Box, Divider, List, ListItem, Paper, Popper } from '@mui/material';
import { useShortRound } from '@shortround/core';
import { helpIntent } from '@/help-intent.js';
import { saveItemIntent } from '@/save-item-intent.js';
import { useCallback, useMemo, useRef, useState } from 'react';
import { autoUpdate, useFloating } from '@floating-ui/react';
import debounce from 'lodash.debounce';
import getCaretCoordinates from 'textarea-caret';
import CaretDropdown from '@/MuiFreeform.jsx';

const defaultIntentions = [helpIntent, saveItemIntent];

function IntentionList({ intentions, anchorEl, onClose, onSelect, selectedIndex, floatingStyles }) {
  if (!anchorEl) {
    return null;
  }

  console.log('selectedIndex', selectedIndex);

  return (
    <Popper open={!!anchorEl} anchorEl={anchorEl} placement="bottom-start" style={floatingStyles}>
      <Paper>
        <List>
          {intentions.map((intention, index) => {
            const sx =
              index === selectedIndex
                ? {
                    backgroundColor: 'action.selected',
                    '&:hover': {
                      backgroundColor: 'action.hover'
                    }
                  }
                : undefined;
            return (
              <ListItem
                key={intention.id}
                onClick={() => onSelect(intention)}
                selected={index === selectedIndex}
                sx={sx}
              >
                {intention.title}
              </ListItem>
            );
          })}
        </List>
      </Paper>
    </Popper>
  );
}

function MuiTextArea() {
  const [anchor, setAnchor] = useState(null);
  const [text, setText] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef();
  const { onInputChange, intentions, dispatch } = useShortRound({
    defaultIntentions
  });

  const { refs, floatingStyles } = useFloating({
    whileElementsMounted: autoUpdate,
    placement: 'bottom-start'
  });

  const debouncedOnInputChange = useMemo(() => debounce(onInputChange, 300), [onInputChange]);

  const onTextChange = useCallback(
    (event) => {
      const newText = event.target.value;
      const currentWord = newText.slice(0, event.target.selectionStart).split(' ').pop();
      debouncedOnInputChange(currentWord);
      setText(newText);

      if (currentWord) {
        const caret = getCaretCoordinates(event.target, event.target.selectionStart);
        const inputRect = event.target.getBoundingClientRect();
        const rect = {
          width: 0,
          height: 0,
          x: inputRect.left + caret.left,
          y: inputRect.top + caret.top + caret.height,
          top: inputRect.top + caret.top + caret.height,
          left: inputRect.left + caret.left,
          right: inputRect.left + caret.left,
          bottom: inputRect.top + caret.top + caret.height
        };
        setAnchor({
          getBoundingClientRect: () => rect
        });
        refs.setReference({
          getBoundingClientRect: () => rect
        });
      } else {
        setAnchor(null);
      }
      // setSelectedIndex(0);
    },
    [debouncedOnInputChange, refs]
  );

  const onSelect = (intention) => {
    const words = text.split(' ');
    words.pop();
    const newText = [...words, intention.title].join(' ') + ' ';
    setText(newText);
    // console.log('Selected intention:', intention);
    dispatch(intention.id);
    setAnchor(null);
  };

  const onKeyDown = (event) => {
    if (anchor) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((prevIndex) => (prevIndex + 1) % intentions.length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((prevIndex) => (prevIndex - 1 + intentions.length) % intentions.length);
      } else if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        onSelect(intentions[selectedIndex]);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setAnchor(null);
      }
    }
  };

  const onClose = () => setAnchor(null);

  return (
    <Box sx={{ p: 10, m: 'auto', width: '100%' }}>
      <Box sx={{ m: 'auto', width: '100%' }}>
        {/*<TextField*/}
        {/*  inputRef={inputRef}*/}
        {/*  sx={{ width: 600 }}*/}
        {/*  label="Intention ..."*/}
        {/*  multiline*/}
        {/*  rows={4}*/}
        {/*  value={text}*/}
        {/*  onChange={onTextChange}*/}
        {/*  onKeyDown={onKeyDown}*/}
        {/*/>*/}
        {/*<IntentionList*/}
        {/*  intentions={intentions}*/}
        {/*  anchorEl={anchor}*/}
        {/*  onClose={onClose}*/}
        {/*  onSelect={onSelect}*/}
        {/*  selectedIndex={selectedIndex}*/}
        {/*  floatingStyles={floatingStyles}*/}
        {/*/>*/}
      </Box>
      <Divider />
      <CaretDropdown />
    </Box>
  );
}

export default MuiTextArea;
