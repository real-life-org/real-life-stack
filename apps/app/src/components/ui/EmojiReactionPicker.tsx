import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Search, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';

// Default recent emojis (Telegram-style defaults)
const DEFAULT_RECENT_EMOJIS = ['❤️', '👍', '👎', '😂', '😢', '😮', '😡', '🔥'];

// Emoji categories with popular emojis
const EMOJI_CATEGORIES = {
  recent: {
    name: 'Zuletzt verwendet',
    icon: '🕐',
    emojis: DEFAULT_RECENT_EMOJIS
  },
  people: {
    name: 'Personen',
    icon: '😀',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊',
      '😇', '🥰', '😍', '🤩', '😘', '😗', '☺️', '😚', '😙', '😋', '😛', '😜',
      '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶',
      '😏', '😒', '🙄', '😬', '🤥', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕',
      '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓'
    ]
  },
  nature: {
    name: 'Tiere & Natur',
    icon: '🐶',
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮',
      '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤',
      '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛',
      '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🕸️', '🦂', '🐢', '🐍', '🦎'
    ]
  },
  food: {
    name: 'Essen & Trinken',
    icon: '🍎',
    emojis: [
      '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑',
      '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑',
      '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥖', '🍞', '🥨', '🥯',
      '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🌭', '🍔'
    ]
  },
  activities: {
    name: 'Aktivitäten',
    icon: '⚽',
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓',
      '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿',
      '🥊', '🥋', '🎽', '🛹', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️‍♀️',
      '🏋️', '🏋️‍♂️', '🤼‍♀️', '🤼', '🤼‍♂️', '🤸‍♀️', '🤸', '🤸‍♂️', '⛹️‍♀️', '⛹️', '⛹️‍♂️', '💪'
    ]
  },
  objects: {
    name: 'Objekte',
    icon: '💡',
    emojis: [
      '💡', '🔦', '🏮', '🪔', '📱', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '💽',
      '💾', '💿', '📀', '🧮', '🎥', '📽️', '📺', '📷', '📸', '📹', '📼', '🔍',
      '🔎', '🕯️', '💰', '💴', '💵', '💶', '💷', '💸', '💳', '🧾', '💹', '💱',
      '💲', '⚖️', '🪜', '🧰', '🪛', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🪚', '🔩', '🚀'
    ]
  },
  symbols: {
    name: 'Symbole',
    icon: '❤️',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕',
      '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️',
      '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌',
      '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '🙏',
      '🎉', '🎊', '🎈', '🎁', '🎀', '🎂', '🎄', '🎃', '👻', '🎭', '🎨', '🎪', '🎫', '🎬',
      '🎤', '🎧', '🎼', '🎵', '🎶', '🎹', '🥁', '🎷', '🎺', '🎸', '🎻',
      '🔥', '💥', '💫', '💦', '💨', '⭐', '🌟', '✨', '⚡', '☄️',
      '☀️', '🌤️', '⛅', '🌦️', '🌧️', '⛈️', '🌩️', '🌨️', '❄️', '☃️', '⛄', '🌬️', '🌪️', '🌈', '🌂', '☂️', '☔', '⛱️'
    ]
  }
};

const EmojiReactionPicker = ({ onEmojiSelect, onClose, reactions = {}, className = "" }) => {
  const [activeCategory, setActiveCategory] = useState('recent');
  const [searchQuery, setSearchQuery] = useState('');
  const [recentEmojis, setRecentEmojis] = useState(DEFAULT_RECENT_EMOJIS);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Get all emojis for search
  const allEmojis = Object.values(EMOJI_CATEGORIES).flatMap(cat => cat.emojis);

  // Comprehensive emoji name mapping for search
  const emojiNames = {
    // People & Faces
    '😀': ['lächeln', 'smile', 'happy', 'glücklich', 'freude', 'grinning'],
    '😃': ['lächeln', 'smile', 'happy', 'glücklich', 'freude', 'smiley'],
    '😄': ['lächeln', 'smile', 'happy', 'glücklich', 'freude', 'augen', 'eyes'],
    '😁': ['grinsen', 'grin', 'happy', 'glücklich', 'zähne', 'teeth'],
    '😆': ['lachen', 'laugh', 'happy', 'glücklich', 'augen', 'closed'],
    '😅': ['lachen', 'laugh', 'schweiß', 'sweat', 'nervous', 'nervös'],
    '🤣': ['lachen', 'laugh', 'rolling', 'floor', 'boden', 'lustig'],
    '😂': ['lachen', 'laugh', 'tränen', 'tears', 'lol', 'freude', 'joy'],
    '🙂': ['lächeln', 'smile', 'leicht', 'slight', 'happy'],
    '🙃': ['verkehrt', 'upside', 'down', 'umgedreht', 'sarkasmus'],
    '😉': ['zwinkern', 'wink', 'flirt', 'augenzwinkern'],
    '😊': ['lächeln', 'smile', 'happy', 'erröten', 'blush', 'schüchtern'],
    '😇': ['heilig', 'angel', 'engel', 'unschuldig', 'innocent'],
    '🥰': ['liebe', 'love', 'herzen', 'hearts', 'verliebt', 'adoring'],
    '😍': ['liebe', 'love', 'herz', 'heart', 'augen', 'verliebt', 'heart eyes'],
    '🤩': ['star', 'stern', 'begeistert', 'starstruck', 'wow', 'amazed'],
    '😘': ['kuss', 'kiss', 'herz', 'heart', 'liebe', 'love'],
    '😗': ['kuss', 'kiss', 'pfeifen', 'whistle', 'küssen'],
    '☺️': ['lächeln', 'smile', 'happy', 'relaxed', 'entspannt'],
    '😚': ['kuss', 'kiss', 'augen', 'closed', 'geschlossen'],
    '😙': ['kuss', 'kiss', 'lächeln', 'smile', 'zwinkern'],
    '😋': ['lecker', 'yummy', 'zunge', 'tongue', 'tasty', 'schmackhaft'],
    '😛': ['zunge', 'tongue', 'frech', 'cheeky', 'playful'],
    '😜': ['zunge', 'tongue', 'zwinkern', 'wink', 'crazy', 'verrückt'],
    '🤪': ['verrückt', 'crazy', 'wild', 'zany', 'durchgeknallt'],
    '😝': ['zunge', 'tongue', 'augen', 'closed', 'frech', 'squinting'],
    '🤑': ['geld', 'money', 'dollar', 'reich', 'rich', 'greedy'],
    '🤗': ['umarmung', 'hug', 'embrace', 'umarmen', 'hands', 'danke', 'thank', 'you'],
    '🤭': ['kichern', 'giggle', 'hand', 'mouth', 'mund', 'verdecken'],
    '🤫': ['leise', 'quiet', 'shh', 'psst', 'schweigen', 'silence'],
    '🤔': ['denken', 'think', 'überlegen', 'thinking', 'nachdenklich'],
    '🤐': ['schweigen', 'silence', 'zipper', 'mund', 'mouth', 'verschlossen'],
    '🤨': ['skeptisch', 'skeptical', 'misstrauisch', 'eyebrow', 'augenbraue'],
    '😐': ['neutral', 'ausdruckslos', 'expressionless', 'meh'],
    '😑': ['ausdruckslos', 'expressionless', 'meh', 'genervt'],
    '😶': ['stumm', 'mute', 'schweigen', 'silence', 'kein', 'mouth'],
    '😏': ['selbstgefällig', 'smirk', 'frech', 'arrogant', 'smug'],
    '😒': ['gelangweilt', 'bored', 'unamused', 'genervt', 'annoyed'],
    '🙄': ['augen', 'roll', 'eyes', 'genervt', 'annoyed', 'whatever'],
    '😬': ['grimasse', 'grimace', 'awkward', 'peinlich', 'zähne'],
    '🤥': ['lügen', 'lie', 'liar', 'nase', 'nose', 'pinocchio'],
    '😔': ['traurig', 'sad', 'depressed', 'pensive', 'nachdenklich'],
    '😪': ['müde', 'tired', 'sleepy', 'schläfrig', 'blase', 'bubble'],
    '🤤': ['sabbern', 'drool', 'hungry', 'hungrig', 'lecker'],
    '😴': ['schlafen', 'sleep', 'müde', 'tired', 'sleeping', 'zzz'],
    '😷': ['krank', 'sick', 'mask', 'maske', 'medical', 'medizinisch'],
    '🤒': ['krank', 'sick', 'thermometer', 'fieber', 'fever'],
    '🤕': ['verletzt', 'injured', 'hurt', 'bandage', 'verband', 'kopf'],
    '🤢': ['übel', 'nausea', 'krank', 'sick', 'green', 'grün'],
    '🤮': ['kotzen', 'vomit', 'puke', 'sick', 'krank', 'spew'],
    '🤧': ['niesen', 'sneeze', 'sick', 'krank', 'tissue', 'taschentuch'],
    '🥵': ['heiß', 'hot', 'sweat', 'schweiß', 'warm', 'overheated'],
    '🥶': ['kalt', 'cold', 'freezing', 'frieren', 'blue', 'blau'],
    '🥴': ['schwindelig', 'dizzy', 'drunk', 'betrunken', 'woozy'],
    '😵': ['schwindelig', 'dizzy', 'dead', 'tot', 'knocked out'],
    '🤯': ['mind', 'blown', 'exploding', 'head', 'kopf', 'wow'],
    '🤠': ['cowboy', 'hat', 'western', 'cool'],
    '🥳': ['party', 'feier', 'celebration', 'hat', 'partying'],
    '😎': ['cool', 'sunglasses', 'sonnenbrille', 'awesome', 'toll'],
    '🤓': ['nerd', 'geek', 'smart', 'klug', 'glasses', 'brille'],
    '🙏': ['beten', 'pray', 'please', 'bitte', 'hope', 'hoffnung', 'danke', 'thank', 'you', 'dankbar', 'grateful'],

    // Animals & Nature
    '🐶': ['hund', 'dog', 'puppy', 'welpe', 'tier', 'animal'],
    '🐱': ['katze', 'cat', 'kitten', 'kätzchen', 'tier', 'animal'],
    '🐭': ['maus', 'mouse', 'tier', 'animal', 'klein', 'small'],
    '🐹': ['hamster', 'tier', 'animal', 'klein', 'small', 'niedlich'],
    '🐰': ['hase', 'rabbit', 'bunny', 'tier', 'animal', 'osterhase'],
    '🦊': ['fuchs', 'fox', 'tier', 'animal', 'clever', 'schlau'],
    '🐻': ['bär', 'bear', 'tier', 'animal', 'groß', 'big'],
    '🐼': ['panda', 'bär', 'bear', 'tier', 'animal', 'china'],
    '🐨': ['koala', 'bär', 'bear', 'tier', 'animal', 'australien'],
    '🐯': ['tiger', 'tier', 'animal', 'stripes', 'streifen', 'katze'],
    '🦁': ['löwe', 'lion', 'tier', 'animal', 'king', 'könig', 'mähne'],
    '🐮': ['kuh', 'cow', 'tier', 'animal', 'milch', 'milk', 'farm'],
    '🐷': ['schwein', 'pig', 'tier', 'animal', 'farm', 'bauernhof'],
    '🐽': ['schwein', 'pig', 'nase', 'nose', 'tier', 'animal'],
    '🐸': ['frosch', 'frog', 'tier', 'animal', 'grün', 'green'],
    '🐵': ['affe', 'monkey', 'tier', 'animal', 'banana', 'banane'],
    '🙈': ['affe', 'monkey', 'see', 'no', 'evil', 'böse', 'nichts', 'sehen'],
    '🙉': ['affe', 'monkey', 'hear', 'no', 'evil', 'böse', 'nichts', 'hören'],
    '🙊': ['affe', 'monkey', 'speak', 'no', 'evil', 'böse', 'nichts', 'sagen'],
    '🐒': ['affe', 'monkey', 'tier', 'animal'],
    '🐔': ['huhn', 'chicken', 'hen', 'henne', 'tier', 'animal', 'farm'],
    '🐧': ['pinguin', 'penguin', 'tier', 'animal', 'kalt', 'cold'],
    '🐦': ['vogel', 'bird', 'tier', 'animal', 'fliegen', 'fly'],
    '🐤': ['küken', 'chick', 'baby', 'bird', 'vogel', 'gelb', 'yellow'],
    '🐣': ['küken', 'chick', 'hatching', 'schlüpfend', 'ei', 'egg'],
    '🐥': ['küken', 'chick', 'front', 'vorne', 'baby', 'bird'],
    '🦆': ['ente', 'duck', 'tier', 'animal', 'wasser', 'water'],
    '🦅': ['adler', 'eagle', 'tier', 'animal', 'bird', 'vogel'],
    '🦉': ['eule', 'owl', 'tier', 'animal', 'nacht', 'night', 'wise'],
    '🦇': ['fledermaus', 'bat', 'tier', 'animal', 'nacht', 'night'],
    '🐺': ['wolf', 'tier', 'animal', 'howl', 'heulen'],
    '🐗': ['wildschwein', 'boar', 'wild', 'pig', 'schwein', 'tier'],
    '🐴': ['pferd', 'horse', 'tier', 'animal', 'reiten', 'ride'],
    '🦄': ['einhorn', 'unicorn', 'magic', 'magie', 'fantasy'],
    '🐝': ['biene', 'bee', 'tier', 'animal', 'honig', 'honey'],
    '🐛': ['wurm', 'worm', 'bug', 'käfer', 'tier', 'animal'],
    '🦋': ['schmetterling', 'butterfly', 'tier', 'animal', 'schön'],
    '🐌': ['schnecke', 'snail', 'tier', 'animal', 'langsam', 'slow'],
    '🐞': ['marienkäfer', 'ladybug', 'käfer', 'beetle', 'glück', 'luck'],
    '🐜': ['ameise', 'ant', 'tier', 'animal', 'klein', 'small'],
    '🦟': ['mücke', 'mosquito', 'tier', 'animal', 'stechen'],
    '🦗': ['grille', 'cricket', 'tier', 'animal', 'sound', 'geräusch'],
    '🕷️': ['spinne', 'spider', 'tier', 'animal', 'web', 'netz'],
    '🕸️': ['spinnennetz', 'spider', 'web', 'netz'],
    '🦂': ['skorpion', 'scorpion', 'tier', 'animal', 'stechen'],
    '🐢': ['schildkröte', 'turtle', 'tier', 'animal', 'langsam'],
    '🐍': ['schlange', 'snake', 'tier', 'animal', 'gift', 'poison'],
    '🦎': ['echse', 'lizard', 'tier', 'animal', 'reptil'],

    // Food & Drink
    '🍎': ['apfel', 'apple', 'frucht', 'fruit', 'rot', 'red', 'gesund'],
    '🍐': ['birne', 'pear', 'frucht', 'fruit', 'grün', 'green'],
    '🍊': ['orange', 'frucht', 'fruit', 'zitrus', 'citrus'],
    '🍋': ['zitrone', 'lemon', 'frucht', 'fruit', 'gelb', 'yellow', 'sauer'],
    '🍌': ['banane', 'banana', 'frucht', 'fruit', 'gelb', 'yellow'],
    '🍉': ['wassermelone', 'watermelon', 'frucht', 'fruit', 'sommer'],
    '🍇': ['trauben', 'grapes', 'frucht', 'fruit', 'wein', 'wine'],
    '🍓': ['erdbeere', 'strawberry', 'frucht', 'fruit', 'rot', 'red'],
    '🥝': ['kiwi', 'frucht', 'fruit', 'grün', 'green'],
    '🍅': ['tomate', 'tomato', 'gemüse', 'vegetable', 'rot', 'red'],
    '🥑': ['avocado', 'frucht', 'fruit', 'grün', 'green', 'gesund'],
    '🍞': ['brot', 'bread', 'backen', 'bake', 'essen', 'food'],
    '🥖': ['baguette', 'french', 'französisch', 'brot', 'bread'],
    '🧀': ['käse', 'cheese', 'yellow', 'gelb', 'dairy'],
    '🥚': ['ei', 'egg', 'breakfast', 'frühstück', 'protein'],
    '🍳': ['ei', 'egg', 'fried', 'gebraten', 'pfanne', 'pan'],
    '🥞': ['pfannkuchen', 'pancake', 'stack', 'stapel', 'breakfast'],
    '🧇': ['waffel', 'waffle', 'breakfast', 'frühstück', 'süß'],
    '🥓': ['speck', 'bacon', 'breakfast', 'frühstück', 'fleisch'],
    '🍗': ['hähnchen', 'chicken', 'fleisch', 'meat', 'drumstick'],
    '🍖': ['fleisch', 'meat', 'bone', 'knochen', 'bbq'],
    '🌭': ['hotdog', 'wurst', 'sausage', 'fast', 'food'],
    '🍔': ['burger', 'hamburger', 'fast', 'food', 'fleisch'],
    '🍕': ['pizza', 'italien', 'italian', 'cheese', 'käse'],

    // Activities
    '⚽': ['fußball', 'football', 'soccer', 'ball', 'sport'],
    '🏀': ['basketball', 'ball', 'sport', 'orange'],
    '🏈': ['american', 'football', 'ball', 'sport', 'usa'],
    '⚾': ['baseball', 'ball', 'sport', 'america'],
    '🎾': ['tennis', 'ball', 'sport', 'gelb', 'yellow'],
    '🏐': ['volleyball', 'ball', 'sport', 'beach'],
    '🏉': ['rugby', 'ball', 'sport'],
    '🎱': ['billard', 'billiards', 'pool', 'ball', 'eight'],
    '🏓': ['pingpong', 'table', 'tennis', 'ball', 'sport'],
    '🏸': ['badminton', 'sport', 'racket', 'schläger'],
    '🥊': ['boxen', 'boxing', 'gloves', 'handschuhe', 'sport'],
    '💪': ['stark', 'strong', 'muscle', 'muskel', 'power', 'kraft', 'bicep'],
    '🎯': ['dart', 'target', 'ziel', 'bullseye'],
    '🎮': ['gaming', 'game', 'spiel', 'controller', 'video'],
    '🎲': ['würfel', 'dice', 'game', 'spiel', 'luck', 'glück'],
    '♠️': ['spades', 'pik', 'karten', 'cards', 'poker'],
    '♥️': ['herz', 'heart', 'hearts', 'karten', 'cards', 'liebe'],
    '♦️': ['diamond', 'karo', 'diamonds', 'karten', 'cards'],
    '♣️': ['clubs', 'kreuz', 'karten', 'cards', 'poker'],

    // Objects
    '💡': ['glühbirne', 'bulb', 'light', 'licht', 'idee', 'idea'],
    '🔦': ['taschenlampe', 'flashlight', 'torch', 'licht', 'light'],
    '📱': ['handy', 'phone', 'mobile', 'smartphone', 'telefon'],
    '💻': ['laptop', 'computer', 'notebook', 'work', 'arbeit'],
    '⌨️': ['tastatur', 'keyboard', 'typing', 'tippen', 'computer'],
    '🖥️': ['monitor', 'computer', 'desktop', 'bildschirm', 'screen'],
    '🖨️': ['drucker', 'printer', 'print', 'drucken', 'paper'],
    '🖱️': ['maus', 'mouse', 'computer', 'click', 'klick'],
    '💽': ['minidisc', 'disc', 'computer', 'storage', 'speicher'],
    '💾': ['floppy', 'disk', 'save', 'speichern', 'computer'],
    '💿': ['cd', 'disc', 'music', 'musik', 'computer'],
    '📀': ['dvd', 'disc', 'movie', 'film', 'video'],
    '🎥': ['kamera', 'camera', 'movie', 'film', 'video'],
    '📽️': ['projektor', 'projector', 'movie', 'film', 'kino'],
    '📺': ['tv', 'television', 'fernseher', 'watch', 'schauen'],
    '📷': ['kamera', 'camera', 'photo', 'foto', 'picture'],
    '📸': ['kamera', 'camera', 'flash', 'blitz', 'photo'],
    '📹': ['camcorder', 'video', 'camera', 'kamera', 'film'],
    '🔍': ['lupe', 'magnifying', 'glass', 'search', 'suchen'],
    '🔎': ['lupe', 'magnifying', 'glass', 'search', 'suchen'],
    '🕯️': ['kerze', 'candle', 'licht', 'light', 'flame'],
    '💰': ['geld', 'money', 'bag', 'sack', 'dollar', 'reich'],
    '💴': ['yen', 'japan', 'money', 'geld', 'währung'],
    '💵': ['dollar', 'usa', 'money', 'geld', 'währung'],
    '💶': ['euro', 'europe', 'money', 'geld', 'währung'],
    '💷': ['pound', 'britain', 'money', 'geld', 'währung'],

    // Symbols
    '❤️': ['herz', 'heart', 'liebe', 'love', 'rot', 'red'],
    '🧡': ['herz', 'heart', 'orange', 'liebe', 'love'],
    '💛': ['herz', 'heart', 'gelb', 'yellow', 'liebe', 'love'],
    '💚': ['herz', 'heart', 'grün', 'green', 'liebe', 'love'],
    '💙': ['herz', 'heart', 'blau', 'blue', 'liebe', 'love'],
    '💜': ['herz', 'heart', 'lila', 'purple', 'liebe', 'love'],
    '🖤': ['herz', 'heart', 'schwarz', 'black', 'liebe', 'love'],
    '🤍': ['herz', 'heart', 'weiß', 'white', 'liebe', 'love'],
    '🤎': ['herz', 'heart', 'braun', 'brown', 'liebe', 'love'],
    '💔': ['herz', 'heart', 'broken', 'gebrochen', 'traurig', 'sad'],
    '❣️': ['herz', 'heart', 'exclamation', 'ausrufezeichen', 'liebe'],
    '💕': ['herzen', 'hearts', 'two', 'zwei', 'liebe', 'love'],
    '💞': ['herzen', 'hearts', 'revolving', 'kreisend', 'liebe'],
    '💓': ['herz', 'heart', 'beating', 'schlagend', 'liebe'],
    '💗': ['herz', 'heart', 'growing', 'wachsend', 'liebe'],
    '💖': ['herz', 'heart', 'sparkling', 'funkelnd', 'liebe'],
    '💘': ['herz', 'heart', 'arrow', 'pfeil', 'cupid', 'amor'],
    '💝': ['herz', 'heart', 'ribbon', 'schleife', 'geschenk'],
    '💟': ['herz', 'heart', 'decoration', 'dekoration', 'liebe'],
    '☮️': ['peace', 'frieden', 'symbol', 'hippie'],
    '✝️': ['kreuz', 'cross', 'christian', 'christlich', 'religion'],
    '☪️': ['islam', 'muslim', 'moon', 'mond', 'stern', 'religion'],
    '🕉️': ['om', 'hinduism', 'buddhism', 'religion', 'symbol'],
    '☸️': ['dharma', 'wheel', 'rad', 'buddhism', 'religion'],
    '✡️': ['david', 'star', 'stern', 'jewish', 'jüdisch', 'religion'],
    '🔯': ['star', 'stern', 'six', 'sechs', 'pointed'],
    '🕎': ['menorah', 'jewish', 'jüdisch', 'candles', 'kerzen'],
    '☯️': ['yin', 'yang', 'balance', 'gleichgewicht', 'symbol'],
    '☦️': ['orthodox', 'cross', 'kreuz', 'christian', 'religion'],
    '🛐': ['worship', 'anbetung', 'religion', 'place', 'ort'],
    '⚛️': ['atom', 'science', 'wissenschaft', 'physics', 'physik'],
    '🉑': ['accept', 'akzeptieren', 'japanese', 'japanisch'],
    '☢️': ['radioactive', 'radioaktiv', 'nuclear', 'nuklear'],
    '☣️': ['biohazard', 'bio', 'gefahr', 'hazard', 'toxic'],
    '🔥': ['feuer', 'fire', 'hot', 'heiß', 'flame', 'flamme'],
    '💥': ['explosion', 'boom', 'bang', 'knall', 'comic'],
    '💫': ['star', 'stern', 'dizzy', 'schwindelig', 'sparkle'],
    '💦': ['wasser', 'water', 'drops', 'tropfen', 'sweat'],
    '💨': ['wind', 'dash', 'fast', 'schnell', 'speed'],
    '⭐': ['stern', 'star', 'favorite', 'favorit', 'rating'],
    '🌟': ['stern', 'star', 'glowing', 'leuchtend', 'bright'],
    '✨': ['sparkles', 'funken', 'magic', 'magie', 'clean'],
    '⚡': ['blitz', 'lightning', 'thunder', 'donner', 'power'],
    '☄️': ['comet', 'komet', 'space', 'weltall', 'meteor'],
    '🚀': ['rocket', 'rakete', 'space', 'weltall', 'fast', 'schnell', 'launch'],
    '☀️': ['sonne', 'sun', 'bright', 'hell', 'weather'],
    '🌤️': ['sonne', 'sun', 'cloud', 'wolke', 'partly'],
    '⛅': ['wolke', 'cloud', 'sonne', 'sun', 'weather'],
    '🌦️': ['regen', 'rain', 'sonne', 'sun', 'weather'],
    '🌧️': ['regen', 'rain', 'weather', 'wetter', 'cloud'],
    '⛈️': ['sturm', 'storm', 'thunder', 'donner', 'lightning'],
    '🌩️': ['blitz', 'lightning', 'thunder', 'donner', 'storm'],
    '🌨️': ['schnee', 'snow', 'winter', 'cold', 'kalt'],
    '❄️': ['schneeflocke', 'snowflake', 'winter', 'cold', 'kalt'],
    '☃️': ['schneemann', 'snowman', 'winter', 'cold', 'kalt'],
    '⛄': ['schneemann', 'snowman', 'winter', 'cold', 'kalt'],
    '🌬️': ['wind', 'face', 'gesicht', 'blow', 'blasen'],
    '🌪️': ['tornado', 'wirbelsturm', 'cyclone', 'wind'],
    '🌈': ['regenbogen', 'rainbow', 'colors', 'farben', 'weather'],
    '🌂': ['regenschirm', 'umbrella', 'rain', 'regen', 'closed'],
    '☂️': ['regenschirm', 'umbrella', 'rain', 'regen', 'open'],
    '☔': ['regen', 'rain', 'umbrella', 'regenschirm', 'weather'],
    '⛱️': ['sonnenschirm', 'umbrella', 'beach', 'strand', 'summer'],
    '🎉': ['party', 'feier', 'celebration', 'confetti', 'konfetti'],
    '🎊': ['confetti', 'konfetti', 'party', 'feier', 'celebration'],
    '🎈': ['ballon', 'balloon', 'party', 'feier', 'celebration'],
    '🎁': ['geschenk', 'gift', 'present', 'box', 'wrapped'],
    '🎀': ['schleife', 'ribbon', 'bow', 'pink', 'decoration'],
    '🎂': ['kuchen', 'cake', 'birthday', 'geburtstag', 'celebration'],
    '🎄': ['weihnachtsbaum', 'christmas', 'tree', 'baum', 'holiday'],
    '🎃': ['kürbis', 'pumpkin', 'halloween', 'orange', 'jack'],
    '👻': ['geist', 'ghost', 'halloween', 'spooky', 'scary'],
    '🎭': ['theater', 'masks', 'masken', 'drama', 'comedy'],
    '🎨': ['kunst', 'art', 'palette', 'paint', 'malen'],
    '🎪': ['zirkus', 'circus', 'tent', 'zelt', 'carnival'],
    '🎫': ['ticket', 'eintrittskarte', 'event', 'veranstaltung'],
    '🎬': ['film', 'movie', 'cinema', 'kino', 'action'],
    '🎤': ['mikrofon', 'microphone', 'sing', 'singen', 'karaoke'],
    '🎧': ['kopfhörer', 'headphones', 'music', 'musik', 'listen'],
    '🎼': ['noten', 'musical', 'score', 'music', 'musik'],
    '🎵': ['note', 'note', 'music', 'musik', 'sound'],
    '🎶': ['noten', 'notes', 'music', 'musik', 'melody'],
    '🎹': ['klavier', 'piano', 'keyboard', 'music', 'musik'],
    '🥁': ['trommel', 'drum', 'music', 'musik', 'beat'],
    '🎷': ['saxophon', 'saxophone', 'music', 'musik', 'jazz'],
    '🎺': ['trompete', 'trumpet', 'music', 'musik', 'brass'],
    '🎸': ['gitarre', 'guitar', 'music', 'musik', 'rock'],
    '🎻': ['violine', 'violin', 'music', 'musik', 'classical']
  };

  // Filter emojis based on search
  const filteredEmojis = searchQuery
    ? allEmojis.filter(emoji => {
        const query = searchQuery.toLowerCase();
        const names = emojiNames[emoji] || [];
        return names.some(name => name.includes(query)) || emoji.includes(query);
      })
    : EMOJI_CATEGORIES[activeCategory].emojis;

  // Update recent emojis category with actual recent usage
  const categoriesWithRecent = {
    ...EMOJI_CATEGORIES,
    recent: {
      ...EMOJI_CATEGORIES.recent,
      emojis: recentEmojis
    }
  };

  const handleEmojiClick = (emoji, e) => {
    e.stopPropagation();
    e.preventDefault();

    onEmojiSelect(emoji);
    onClose();
  };

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <motion.div
      ref={pickerRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={`absolute z-50 bg-slate-800 border border-slate-600 rounded-lg shadow-xl flex flex-col ${className}`}
      style={{ width: '320px', height: '400px' }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Search bar */}
      <div className="p-3 border-b border-slate-600">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Emoji suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-700 border-slate-600 text-white placeholder-slate-400"
          />
        </div>
      </div>

      {/* Category tabs - only show when not searching */}
      {!searchQuery && (
        <div className="flex border-b border-slate-600 overflow-x-auto">
          {Object.entries(categoriesWithRecent).map(([key, category]) => (
            <Button
              key={key}
              variant="ghost"
              size="sm"
              className={`flex-shrink-0 px-3 py-2 text-xs ${
                activeCategory === key
                  ? 'text-white border-b-2 border-purple-500'
                  : 'text-slate-400 hover:text-white'
              }`}
              onClick={() => setActiveCategory(key)}
            >
              <span className="mr-1">{category.icon}</span>
            </Button>
          ))}
        </div>
      )}

      {/* Emoji grid */}
      <div className="flex-1 overflow-y-auto p-2 min-h-0">
        <div className="grid grid-cols-8 gap-1 w-full">
          {filteredEmojis.map((emoji, index) => {
            const reactionCount = reactions[emoji] || 0;
            return (
              <Button
                key={`${emoji}-${index}`}
                variant="ghost"
                size="sm"
                className="h-10 w-10 p-0 hover:bg-slate-700 relative group flex-shrink-0"
                onClick={(e) => handleEmojiClick(emoji, e)}
              >
                <span className="text-lg">{emoji}</span>
                {reactionCount > 0 && (
                  <div className="absolute -top-1 -right-1 bg-purple-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                    {reactionCount}
                  </div>
                )}
              </Button>
            );
          })}
        </div>

        {filteredEmojis.length === 0 && (
          <div className="text-center text-slate-400 py-8">
            Keine Emojis gefunden
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default EmojiReactionPicker;