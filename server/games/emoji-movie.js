// "Crack the Code" (id kept as "emoji-movie" for protocol/tournament
// compatibility) — a speed guessing game. Each round shows an answer as
// emojis, revealed ONE AT A TIME. The host picks which categories are in
// play: Movies, TV Shows, Countries, Video Games, and Mashup (a 2-emoji
// compound-word variant). Players type the answer on their own phone at
// any point during the reveal; guessing early (fewer emojis shown) is
// worth far more. A wrong guess costs nothing and doesn't lock you out — a
// correct one locks you in for the round. No roles, no hidden info: the
// only thing ever private is a player's in-progress typed guess.

import { drawWithoutRepeats } from "./deck.js";

const MOVIES = [
  // --- Easy: instantly recognizable to almost anyone ---
  { emojis: ["🕷️", "🧑", "🌆"], title: "Spider-Man", alts: ["spidey"], difficulty: "easy" },
  { emojis: ["🦁", "👑", "🌅"], title: "The Lion King", alts: [], difficulty: "easy" },
  { emojis: ["❄️", "⛄", "👸"], title: "Frozen", alts: [], difficulty: "easy" },
  { emojis: ["🚢", "🧊", "💔"], title: "Titanic", alts: [], difficulty: "easy" },
  { emojis: ["🦖", "🌴", "🧬"], title: "Jurassic Park", alts: [], difficulty: "easy" },
  { emojis: ["🐠", "🔍", "🌊"], title: "Finding Nemo", alts: [], difficulty: "easy" },
  { emojis: ["💊", "🕶️", "🐇"], title: "The Matrix", alts: [], difficulty: "easy" },
  { emojis: ["🧸", "🤠", "🚀"], title: "Toy Story", alts: [], difficulty: "easy" },
  { emojis: ["🧛", "✨", "💕"], title: "Twilight", alts: [], difficulty: "easy" },
  { emojis: ["🧞", "🪔", "🐒"], title: "Aladdin", alts: [], difficulty: "easy" },
  { emojis: ["🏴‍☠️", "🦜", "💰"], title: "Pirates of the Caribbean", alts: ["potc", "pirates"], difficulty: "easy" },
  { emojis: ["🧙", "💍", "🌋"], title: "The Lord of the Rings", alts: ["lotr", "fellowship of the ring"], difficulty: "easy" },
  { emojis: ["⚡", "🧙", "🦉"], title: "Harry Potter", alts: ["harry potter and the sorcerers stone", "harry potter and the philosophers stone"], difficulty: "easy" },
  { emojis: ["🚗", "⚡", "🏁"], title: "Cars", alts: [], difficulty: "easy" },
  { emojis: ["🦸", "🛡️", "🌍"], title: "The Avengers", alts: [], difficulty: "easy" },
  { emojis: ["👹", "🧅", "🏰"], title: "Shrek", alts: [], difficulty: "easy" },
  { emojis: ["🌌", "⚔️", "🤖"], title: "Star Wars", alts: [], difficulty: "easy" },
  { emojis: ["🌺", "🌊", "🚣"], title: "Moana", alts: [], difficulty: "easy" },
  { emojis: ["🐼", "🥋", "🍜"], title: "Kung Fu Panda", alts: [], difficulty: "easy" },
  { emojis: ["🤖", "❤️", "🌍"], title: "WALL-E", alts: [], difficulty: "easy" },

  // --- Medium: well known, but the emojis take a beat ---
  { emojis: ["🦇", "🃏", "🌃"], title: "The Dark Knight", alts: ["batman"], difficulty: "medium" },
  { emojis: ["🦈", "🏖️", "🩸"], title: "Jaws", alts: [], difficulty: "medium" },
  { emojis: ["👻", "🔫", "🏙️"], title: "Ghostbusters", alts: [], difficulty: "medium" },
  { emojis: ["🐀", "👨‍🍳", "🍅"], title: "Ratatouille", alts: [], difficulty: "medium" },
  { emojis: ["👨‍🚀", "🌌", "⏳"], title: "Interstellar", alts: [], difficulty: "medium" },
  { emojis: ["🎈", "🏠", "👴"], title: "Up", alts: [], difficulty: "medium" },
  { emojis: ["🦍", "🏙️", "✈️"], title: "King Kong", alts: [], difficulty: "medium" },
  { emojis: ["🥊", "🏆", "🇺🇸"], title: "Rocky", alts: [], difficulty: "medium" },
  { emojis: ["🕶️", "👽", "🔫"], title: "Men in Black", alts: ["mib"], difficulty: "medium" },
  { emojis: ["🌪️", "👠", "🦁"], title: "The Wizard of Oz", alts: [], difficulty: "medium" },
  { emojis: ["🚗", "⏰", "⚡"], title: "Back to the Future", alts: ["bttf"], difficulty: "medium" },
  { emojis: ["👽", "🚲", "🌕"], title: "E.T. the Extra-Terrestrial", alts: ["et"], difficulty: "medium" },
  { emojis: ["🤖", "🔫", "🕶️"], title: "The Terminator", alts: ["terminator"], difficulty: "medium" },
  { emojis: ["🏃", "🍫", "🪶"], title: "Forrest Gump", alts: [], difficulty: "medium" },
  { emojis: ["🌀", "💤", "🎧"], title: "Inception", alts: [], difficulty: "medium" },
  { emojis: ["🔵", "🌿", "🏹"], title: "Avatar", alts: [], difficulty: "medium" },
  { emojis: ["🏠", "👦", "🕯️"], title: "Home Alone", alts: [], difficulty: "medium" },
  { emojis: ["🎲", "🐘", "🌴"], title: "Jumanji", alts: [], difficulty: "medium" },
  { emojis: ["💀", "🎸", "🌼"], title: "Coco", alts: [], difficulty: "medium" },
  { emojis: ["🕯️", "🏠", "🦋"], title: "Encanto", alts: [], difficulty: "medium" },
  { emojis: ["🌙", "🦹", "👾"], title: "Despicable Me", alts: ["minions"], difficulty: "medium" },
  { emojis: ["🦸‍♂️", "👨‍👩‍👧‍👦", "🎭"], title: "The Incredibles", alts: [], difficulty: "medium" },
  { emojis: ["👿", "🚪", "😱"], title: "Monsters, Inc.", alts: ["monsters inc"], difficulty: "medium" },
  { emojis: ["👽", "🥚", "🚀"], title: "Alien", alts: [], difficulty: "medium" },
  { emojis: ["⚔️", "🏟️", "👑"], title: "Gladiator", alts: [], difficulty: "medium" },
  { emojis: ["🏹", "🔥", "🎯"], title: "The Hunger Games", alts: ["hunger games"], difficulty: "medium" },
  { emojis: ["🎹", "💃", "🌇"], title: "La La Land", alts: [], difficulty: "medium" },
  { emojis: ["🐈‍⬛", "👑", "🌍"], title: "Black Panther", alts: [], difficulty: "medium" },
  { emojis: ["🩸", "🗡️", "😜"], title: "Deadpool", alts: [], difficulty: "medium" },
  { emojis: ["🚀", "🌳", "🦝"], title: "Guardians of the Galaxy", alts: ["gotg"], difficulty: "medium" },
  { emojis: ["👸", "🛡️", "⚔️"], title: "Wonder Woman", alts: [], difficulty: "medium" },
  { emojis: ["🏜️", "🪱", "🌌"], title: "Dune", alts: [], difficulty: "medium" },
  { emojis: ["🏝️", "🏐", "✈️"], title: "Cast Away", alts: ["castaway"], difficulty: "medium" },

  // --- Hard: cult classics, wordplay, or deliberately abstract clues ---
  { emojis: ["🤵", "🐴", "🍊"], title: "The Godfather", alts: ["godfather"], difficulty: "hard" },
  { emojis: ["👦", "👻", "🩺"], title: "The Sixth Sense", alts: ["sixth sense"], difficulty: "hard" },
  { emojis: ["🐹", "📅", "🔁"], title: "Groundhog Day", alts: [], difficulty: "hard" },
  { emojis: ["🤫", "👾", "🌽"], title: "A Quiet Place", alts: [], difficulty: "hard" },
  { emojis: ["🫖", "📷", "🕳️"], title: "Get Out", alts: [], difficulty: "hard" },
  { emojis: ["🪓", "🏨", "🩸"], title: "The Shining", alts: ["shining"], difficulty: "hard" },
  { emojis: ["💰", "❓", "🇮🇳"], title: "Slumdog Millionaire", alts: [], difficulty: "hard" },
  { emojis: ["🎤", "👑", "🎸"], title: "Bohemian Rhapsody", alts: [], difficulty: "hard" },
  { emojis: ["🚗", "🔥", "🏜️"], title: "Mad Max: Fury Road", alts: ["mad max", "fury road"], difficulty: "hard" },
  { emojis: ["🤠", "💨", "🪙"], title: "No Country for Old Men", alts: [], difficulty: "hard" },
  { emojis: ["📺", "🏝️", "🎥"], title: "The Truman Show", alts: ["truman show"], difficulty: "hard" },
  { emojis: ["🪳", "🏠", "💵"], title: "Parasite", alts: [], difficulty: "hard" },
  { emojis: ["🥁", "🎵", "😰"], title: "Whiplash", alts: [], difficulty: "hard" },
  { emojis: ["🎁", "📦", "7️⃣"], title: "Se7en", alts: ["seven"], difficulty: "hard" },
  { emojis: ["🕺", "💼", "🍔"], title: "Pulp Fiction", alts: [], difficulty: "hard" },
  { emojis: ["🧼", "👊", "🧠"], title: "Fight Club", alts: [], difficulty: "hard" },

  // ===== Expansion =====
  // --- Easy ---
  { emojis: ["🐭", "🏰", "✨"], title: "Cinderella", alts: [], difficulty: "easy" },
  { emojis: ["🐷", "🕸️", "🌾"], title: "Charlotte's Web", alts: [], difficulty: "easy" },
  { emojis: ["🐻", "🍯", "🌳"], title: "Winnie the Pooh", alts: ["winnie the pooh"], difficulty: "easy" },
  { emojis: ["👸", "🐸", "💋"], title: "The Princess and the Frog", alts: [], difficulty: "easy" },
  { emojis: ["🦕", "🌋", "🏝️"], title: "The Land Before Time", alts: [], difficulty: "easy" },
  { emojis: ["👧", "🐺", "🌲"], title: "Brave", alts: [], difficulty: "easy" },
  { emojis: ["🐉", "🇨🇳", "⚔️"], title: "Mulan", alts: [], difficulty: "easy" },
  { emojis: ["🍫", "🏭", "🎫"], title: "Charlie and the Chocolate Factory", alts: ["willy wonka", "charlie and the chocolate factory"], difficulty: "easy" },
  { emojis: ["🦖", "🌍", "💥"], title: "Jurassic World", alts: [], difficulty: "easy" },
  { emojis: ["👽", "📞", "🏠"], title: "E.T.", alts: ["et the extraterrestrial"], difficulty: "easy" },
  { emojis: ["🧊", "🦣", "🐿️"], title: "Ice Age", alts: [], difficulty: "easy" },
  { emojis: ["🐟", "🌊", "🧠"], title: "Finding Dory", alts: [], difficulty: "easy" },
  { emojis: ["🕸️", "🧑", "🕷️"], title: "Spider-Man: Into the Spider-Verse", alts: ["spider verse", "into the spiderverse"], difficulty: "easy" },
  { emojis: ["🦸", "👨‍👩‍👧‍👦", "🏝️"], title: "Incredibles 2", alts: [], difficulty: "easy" },
  { emojis: ["🐘", "🪶", "🎪"], title: "Dumbo", alts: [], difficulty: "easy" },
  { emojis: ["🧜‍♀️", "🐚", "🎶"], title: "The Little Mermaid", alts: [], difficulty: "easy" },
  { emojis: ["🐇", "👮", "🦊"], title: "Zootopia", alts: [], difficulty: "easy" },
  { emojis: ["🧒", "🎈", "🏚️"], title: "The Goonies", alts: [], difficulty: "easy" },
  { emojis: ["🐍", "✈️", "😱"], title: "Snakes on a Plane", alts: [], difficulty: "easy" },
  { emojis: ["🎅", "🦌", "🎁"], title: "The Santa Clause", alts: [], difficulty: "easy" },

  // --- Medium ---
  { emojis: ["👑", "🗣️", "🎙️"], title: "The King's Speech", alts: [], difficulty: "medium" },
  { emojis: ["🧑‍🚀", "🥔", "🔴"], title: "The Martian", alts: [], difficulty: "medium" },
  { emojis: ["🗡️", "🏴", "🇬🇧"], title: "Braveheart", alts: [], difficulty: "medium" },
  { emojis: ["🎩", "⏱️", "🐇"], title: "Alice in Wonderland", alts: [], difficulty: "medium" },
  { emojis: ["🧛", "🏰", "🦇"], title: "Dracula", alts: [], difficulty: "medium" },
  { emojis: ["🤖", "🚔", "🏙️"], title: "RoboCop", alts: [], difficulty: "medium" },
  { emojis: ["🏊", "🦈", "🌕"], title: "The Shallows", alts: [], difficulty: "medium" },
  { emojis: ["🧑‍🍳", "🇫🇷", "⭐"], title: "Julie & Julia", alts: [], difficulty: "medium" },
  { emojis: ["🎾", "👨‍👧", "🏆"], title: "King Richard", alts: [], difficulty: "medium" },
  { emojis: ["🚀", "🌑", "🧑‍🚀"], title: "First Man", alts: [], difficulty: "medium" },
  { emojis: ["🐴", "🏜️", "🎖️"], title: "War Horse", alts: [], difficulty: "medium" },
  { emojis: ["🧑‍⚖️", "🦟", "🇺🇸"], title: "To Kill a Mockingbird", alts: [], difficulty: "medium" },
  { emojis: ["👨‍👦", "🌊", "⛵"], title: "Life of Pi", alts: [], difficulty: "medium" },
  { emojis: ["🎸", "😈", "🚌"], title: "School of Rock", alts: [], difficulty: "medium" },
  { emojis: ["🕴️", "☂️", "🌧️"], title: "Kingsman", alts: ["kingsman the secret service"], difficulty: "medium" },
  { emojis: ["🧙‍♂️", "🦁", "❄️"], title: "The Chronicles of Narnia", alts: ["narnia"], difficulty: "medium" },
  { emojis: ["🚂", "❄️", "🌍"], title: "Snowpiercer", alts: [], difficulty: "medium" },
  { emojis: ["👩‍🚀", "🛰️", "🌌"], title: "Gravity", alts: [], difficulty: "medium" },
  { emojis: ["🧑‍🦱", "🥊", "🇺🇸"], title: "Creed", alts: [], difficulty: "medium" },
  { emojis: ["🦇", "🐧", "❄️"], title: "Batman Returns", alts: [], difficulty: "medium" },
  { emojis: ["🕶️", "☀️", "🏝️"], title: "The Beach", alts: [], difficulty: "medium" },
  { emojis: ["🧙‍♀️", "🧹", "🐈‍⬛"], title: "Kiki's Delivery Service", alts: [], difficulty: "medium" },
  { emojis: ["👨‍🏫", "📚", "🍎"], title: "Dead Poets Society", alts: [], difficulty: "medium" },
  { emojis: ["🧑‍🚒", "🔥", "🏢"], title: "Backdraft", alts: [], difficulty: "medium" },
  { emojis: ["🐺", "📈", "💊"], title: "The Wolf of Wall Street", alts: [], difficulty: "medium" },
  { emojis: ["🏒", "🇯🇲", "🛷"], title: "Cool Runnings", alts: [], difficulty: "medium" },
  { emojis: ["🎤", "🎧", "🅰️"], title: "8 Mile", alts: [], difficulty: "medium" },
  { emojis: ["🐒", "🏙️", "🌆"], title: "Rise of the Planet of the Apes", alts: ["planet of the apes"], difficulty: "medium" },
  { emojis: ["👰", "🔪", "🎲"], title: "Ready or Not", alts: [], difficulty: "medium" },
  { emojis: ["🧑‍🚀", "👽", "🌽"], title: "Signs", alts: [], difficulty: "medium" },

  // --- Hard ---
  { emojis: ["🐏", "🔇", "🐻"], title: "The Silence of the Lambs", alts: ["silence of the lambs"], difficulty: "hard" },
  { emojis: ["🕰️", "🌹", "🏰"], title: "The Grand Budapest Hotel", alts: ["grand budapest hotel"], difficulty: "hard" },
  { emojis: ["🧑", "🪞", "🌃"], title: "Taxi Driver", alts: [], difficulty: "hard" },
  { emojis: ["🦌", "🎰", "🇻🇳"], title: "The Deer Hunter", alts: [], difficulty: "hard" },
  { emojis: ["📼", "☎️", "😱"], title: "The Ring", alts: [], difficulty: "hard" },
  { emojis: ["🧑‍🦳", "🌧️", "🔪"], title: "Blade Runner", alts: [], difficulty: "hard" },
  { emojis: ["🚬", "🕵️", "🏙️"], title: "Chinatown", alts: [], difficulty: "hard" },
  { emojis: ["🧠", "💾", "🌀"], title: "Eternal Sunshine of the Spotless Mind", alts: ["eternal sunshine"], difficulty: "hard" },
  { emojis: ["🐁", "🎈", "🤡"], title: "It", alts: [], difficulty: "hard" },
  { emojis: ["🏔️", "🪓", "❄️"], title: "The Revenant", alts: [], difficulty: "hard" },
  { emojis: ["👨‍👦", "🛒", "🔥"], title: "The Road", alts: [], difficulty: "hard" },
  { emojis: ["🕳️", "🪜", "🍴"], title: "The Platform", alts: [], difficulty: "hard" },
  { emojis: ["🎈", "🔴", "🚲"], title: "The Red Balloon", alts: [], difficulty: "hard" },
  { emojis: ["🧊", "🚁", "🐕"], title: "The Thing", alts: [], difficulty: "hard" },
  { emojis: ["👁️", "🔺", "💵"], title: "The Number 23", alts: [], difficulty: "hard" },
  { emojis: ["🧑‍🎨", "👂", "🌻"], title: "Loving Vincent", alts: [], difficulty: "hard" },
  { emojis: ["🚙", "🏞️", "🎯"], title: "Nomadland", alts: [], difficulty: "hard" },
  { emojis: ["🐙", "🤿", "🎓"], title: "My Octopus Teacher", alts: [], difficulty: "hard" },
  { emojis: ["🧑‍🌾", "🐝", "🇮🇹"], title: "Call Me by Your Name", alts: ["call me by your name"], difficulty: "hard" },
  { emojis: ["🎭", "🪜", "🔫"], title: "Joker", alts: [], difficulty: "hard" },
  { emojis: ["🧑‍🚀", "🪐", "🧔"], title: "Ad Astra", alts: [], difficulty: "hard" },
  { emojis: ["🐎", "🌾", "🇰🇷"], title: "The Handmaiden", alts: [], difficulty: "hard" },
  { emojis: ["🥃", "🎳", "🚗"], title: "The Big Lebowski", alts: ["big lebowski"], difficulty: "hard" },
  { emojis: ["🧑‍🦲", "🍊", "🎩"], title: "A Clockwork Orange", alts: ["clockwork orange"], difficulty: "hard" },
  { emojis: ["🦢", "🩰", "🪞"], title: "Black Swan", alts: [], difficulty: "hard" },
];

// --- TV Shows: same shape as MOVIES (3 emojis, title, alts, difficulty).
const TV_SHOWS = [
  // --- Easy ---
  { emojis: ["🧟", "🔫", "🚶"], title: "The Walking Dead", alts: ["twd"], difficulty: "easy" },
  { emojis: ["🐉", "❄️", "👑"], title: "Game of Thrones", alts: ["got"], difficulty: "easy" },
  { emojis: ["🧪", "💊", "🎩"], title: "Breaking Bad", alts: [], difficulty: "easy" },
  { emojis: ["📎", "🖨️", "🏢"], title: "The Office", alts: [], difficulty: "easy" },
  { emojis: ["👾", "🚲", "🧇"], title: "Stranger Things", alts: [], difficulty: "easy" },
  { emojis: ["☕", "🛋️", "👫"], title: "Friends", alts: [], difficulty: "easy" },
  { emojis: ["🏥", "❤️", "🔪"], title: "Grey's Anatomy", alts: ["greys anatomy"], difficulty: "easy" },
  { emojis: ["🍩", "🟡", "🛹"], title: "The Simpsons", alts: [], difficulty: "easy" },
  { emojis: ["🦑", "🔴", "💰"], title: "Squid Game", alts: [], difficulty: "easy" },
  { emojis: ["👑", "🇬🇧", "👸"], title: "The Crown", alts: [], difficulty: "easy" },
  { emojis: ["🧑‍⚕️", "🏥", "😂"], title: "Scrubs", alts: [], difficulty: "easy" },
  { emojis: ["🖖", "🚀", "👽"], title: "Star Trek", alts: [], difficulty: "easy" },
  { emojis: ["🏝️", "✈️", "🔢"], title: "Lost", alts: [], difficulty: "easy" },
  { emojis: ["🧑‍🍳", "🔪", "😰"], title: "The Bear", alts: [], difficulty: "easy" },
  { emojis: ["🐴", "🍺", "📺"], title: "BoJack Horseman", alts: ["bojack"], difficulty: "easy" },

  // --- Medium ---
  { emojis: ["⚖️", "🧑‍⚖️", "💼"], title: "Better Call Saul", alts: ["bcs"], difficulty: "medium" },
  { emojis: ["🎩", "🔫", "🐎"], title: "Peaky Blinders", alts: [], difficulty: "medium" },
  { emojis: ["🧙", "🗡️", "🪙"], title: "The Witcher", alts: [], difficulty: "medium" },
  { emojis: ["🏰", "🐉", "🔥"], title: "House of the Dragon", alts: ["hotd"], difficulty: "medium" },
  { emojis: ["🦸", "🩸", "🥛"], title: "The Boys", alts: [], difficulty: "medium" },
  { emojis: ["🔬", "🚪", "🌀"], title: "Rick and Morty", alts: [], difficulty: "medium" },
  { emojis: ["🤠", "🤖", "🎲"], title: "Westworld", alts: [], difficulty: "medium" },
  { emojis: ["🕵️", "🎻", "🧠"], title: "Sherlock", alts: [], difficulty: "medium" },
  { emojis: ["👔", "💼", "📈"], title: "Suits", alts: [], difficulty: "medium" },
  { emojis: ["🏫", "🎶", "🎭"], title: "Glee", alts: [], difficulty: "medium" },
  { emojis: ["👨‍👩‍👧‍👦", "🎥", "😂"], title: "Modern Family", alts: [], difficulty: "medium" },
  { emojis: ["💃", "🎻", "💌"], title: "Bridgerton", alts: [], difficulty: "medium" },
  { emojis: ["🧑‍🌾", "🐎", "🤠"], title: "Yellowstone", alts: [], difficulty: "medium" },
  { emojis: ["💘", "🪖", "🇰🇷"], title: "Crash Landing on You", alts: [], difficulty: "medium" },
  { emojis: ["🧑‍🎓", "🔪", "🏫"], title: "Elite", alts: [], difficulty: "medium" },
  { emojis: ["🧟", "🏙️", "🔦"], title: "The Last of Us", alts: ["tlou"], difficulty: "medium" },
  { emojis: ["🚒", "🔥", "🚑"], title: "Chicago Fire", alts: [], difficulty: "medium" },
  { emojis: ["🧛", "⚰️", "🏫"], title: "Buffy the Vampire Slayer", alts: ["buffy"], difficulty: "medium" },
  { emojis: ["🧑‍🚀", "🌑", "🛰️"], title: "For All Mankind", alts: [], difficulty: "medium" },

  // --- Hard ---
  { emojis: ["🚬", "🥃", "📺"], title: "Mad Men", alts: [], difficulty: "hard" },
  { emojis: ["🕵️", "🌲", "🏔️"], title: "Twin Peaks", alts: [], difficulty: "hard" },
  { emojis: ["💵", "🚤", "🐟"], title: "Ozark", alts: [], difficulty: "hard" },
  { emojis: ["🧑‍💻", "🎭", "🌍"], title: "Mr. Robot", alts: ["mr robot"], difficulty: "hard" },
  { emojis: ["🕰️", "🔁", "🕳️"], title: "Dark", alts: [], difficulty: "hard" },
  { emojis: ["🏚️", "👮", "🌧️"], title: "True Detective", alts: [], difficulty: "hard" },
  { emojis: ["👻", "🏚️", "🦋"], title: "The Haunting of Hill House", alts: ["hill house"], difficulty: "hard" },
  { emojis: ["🧑‍🔬", "🌌", "⏳"], title: "Devs", alts: [], difficulty: "hard" },
  { emojis: ["🐙", "🏙️", "👁️"], title: "Watchmen", alts: [], difficulty: "hard" },
  { emojis: ["🧑‍🎤", "💊", "🎸"], title: "Euphoria", alts: [], difficulty: "hard" },
  { emojis: ["🏝️", "💃", "🔪"], title: "The White Lotus", alts: ["white lotus"], difficulty: "hard" },
  { emojis: ["🧑‍💼", "🛗", "🧠"], title: "Severance", alts: [], difficulty: "hard" },
  { emojis: ["🤠", "🚀", "🐍"], title: "Firefly", alts: [], difficulty: "hard" },
  { emojis: ["🧑‍🎨", "🏙️", "🎷"], title: "The Wire", alts: [], difficulty: "hard" },

  // --- Reality & competition ---
  { emojis: ["🏝️", "🔥", "🗳️"], title: "Survivor", alts: [], difficulty: "easy" },
  { emojis: ["🌹", "💍", "🥂"], title: "The Bachelor", alts: ["bachelor"], difficulty: "easy" },
  { emojis: ["👁️", "🏠", "📹"], title: "Big Brother", alts: [], difficulty: "easy" },
  { emojis: ["👨‍🍳", "🍳", "🏆"], title: "MasterChef", alts: ["master chef"], difficulty: "easy" },
  { emojis: ["🎤", "🔴", "🪑"], title: "The Voice", alts: [], difficulty: "easy" },
  { emojis: ["🦈", "💰", "🤝"], title: "Shark Tank", alts: [], difficulty: "easy" },
  { emojis: ["💃", "⭐", "🕺"], title: "Dancing with the Stars", alts: ["dwts"], difficulty: "easy" },
  { emojis: ["👑", "💄", "👠"], title: "RuPaul's Drag Race", alts: ["drag race", "rupauls drag race"], difficulty: "medium" },
  { emojis: ["👨‍🍳", "🔥", "😡"], title: "Hell's Kitchen", alts: ["hells kitchen"], difficulty: "medium" },
  { emojis: ["🌍", "🏃", "✈️"], title: "The Amazing Race", alts: [], difficulty: "medium" },
  { emojis: ["🏝️", "💑", "🌴"], title: "Love Island", alts: [], difficulty: "medium" },
  { emojis: ["🏳️‍🌈", "👀", "✨"], title: "Queer Eye", alts: [], difficulty: "medium" },
  { emojis: ["🎪", "🧁", "🇬🇧"], title: "The Great British Bake Off", alts: ["gbbo", "bake off", "the great british baking show"], difficulty: "medium" },
  { emojis: ["💋", "📸", "💰"], title: "Keeping Up with the Kardashians", alts: ["kuwtk", "the kardashians"], difficulty: "medium" },
  { emojis: ["🛋️", "💍", "🙈"], title: "Love Is Blind", alts: [], difficulty: "medium" },
  { emojis: ["🏰", "🗡️", "🎭"], title: "The Traitors", alts: [], difficulty: "hard" },
  { emojis: ["💍", "🛂", "📅"], title: "90 Day Fiancé", alts: ["90 day fiance"], difficulty: "hard" },
  { emojis: ["🛥️", "🍸", "🧹"], title: "Below Deck", alts: [], difficulty: "hard" },
  { emojis: ["🦀", "🌊", "🚢"], title: "Deadliest Catch", alts: [], difficulty: "hard" },
  { emojis: ["🏡", "💎", "🌇"], title: "Selling Sunset", alts: [], difficulty: "hard" },
];

// --- Countries: 3 emojis, and the LAST emoji is ALWAYS that country's flag
// (checked by a test). The first 1-2 are food / landmark / culture clues.
const COUNTRIES = [
  // --- Easy ---
  { emojis: ["🗼", "🥖", "🇫🇷"], title: "France", alts: [], difficulty: "easy" },
  { emojis: ["🍣", "🗻", "🇯🇵"], title: "Japan", alts: [], difficulty: "easy" },
  { emojis: ["🍝", "🍕", "🇮🇹"], title: "Italy", alts: [], difficulty: "easy" },
  { emojis: ["🌮", "🌵", "🇲🇽"], title: "Mexico", alts: [], difficulty: "easy" },
  { emojis: ["🦘", "🐨", "🇦🇺"], title: "Australia", alts: [], difficulty: "easy" },
  { emojis: ["🍁", "🏒", "🇨🇦"], title: "Canada", alts: [], difficulty: "easy" },
  { emojis: ["💃", "🥘", "🇪🇸"], title: "Spain", alts: [], difficulty: "easy" },
  { emojis: ["🍺", "🥨", "🇩🇪"], title: "Germany", alts: [], difficulty: "easy" },
  { emojis: ["🐘", "🍛", "🇮🇳"], title: "India", alts: [], difficulty: "easy" },
  { emojis: ["🐼", "🥟", "🇨🇳"], title: "China", alts: [], difficulty: "easy" },
  { emojis: ["🎡", "🍔", "🇺🇸"], title: "United States", alts: ["usa", "america", "united states of america"], difficulty: "easy" },
  { emojis: ["☕", "⚽", "🇧🇷"], title: "Brazil", alts: [], difficulty: "easy" },
  { emojis: ["🕌", "🐪", "🇪🇬"], title: "Egypt", alts: [], difficulty: "easy" },
  { emojis: ["🎡", "🫖", "🇬🇧"], title: "United Kingdom", alts: ["uk", "britain", "great britain", "england"], difficulty: "easy" },
  { emojis: ["📱", "🎤", "🇰🇷"], title: "South Korea", alts: ["korea"], difficulty: "easy" },

  // --- Medium ---
  { emojis: ["🧀", "🌷", "🇳🇱"], title: "Netherlands", alts: ["holland"], difficulty: "medium" },
  { emojis: ["🎿", "🍫", "🇨🇭"], title: "Switzerland", alts: [], difficulty: "medium" },
  { emojis: ["🏛️", "🫒", "🇬🇷"], title: "Greece", alts: [], difficulty: "medium" },
  { emojis: ["❄️", "🦌", "🇫🇮"], title: "Finland", alts: [], difficulty: "medium" },
  { emojis: ["🦁", "💎", "🇿🇦"], title: "South Africa", alts: [], difficulty: "medium" },
  { emojis: ["🍀", "🎻", "🇮🇪"], title: "Ireland", alts: [], difficulty: "medium" },
  { emojis: ["🍜", "🎎", "🇻🇳"], title: "Vietnam", alts: [], difficulty: "medium" },
  { emojis: ["🌶️", "🛕", "🇹🇭"], title: "Thailand", alts: [], difficulty: "medium" },
  { emojis: ["🧊", "🌋", "🇮🇸"], title: "Iceland", alts: [], difficulty: "medium" },
  { emojis: ["🐫", "🛢️", "🇸🇦"], title: "Saudi Arabia", alts: [], difficulty: "medium" },
  { emojis: ["🎻", "🍷", "🇦🇹"], title: "Austria", alts: [], difficulty: "medium" },
  { emojis: ["🪑", "🍬", "🇸🇪"], title: "Sweden", alts: [], difficulty: "medium" },
  { emojis: ["🥟", "💃", "🇵🇱"], title: "Poland", alts: [], difficulty: "medium" },
  { emojis: ["🧉", "⚽", "🇦🇷"], title: "Argentina", alts: [], difficulty: "medium" },
  { emojis: ["🐟", "🛢️", "🇳🇴"], title: "Norway", alts: [], difficulty: "medium" },
  { emojis: ["🍫", "🚴", "🇧🇪"], title: "Belgium", alts: [], difficulty: "medium" },
  { emojis: ["🐓", "🌊", "🇵🇹"], title: "Portugal", alts: [], difficulty: "medium" },
  { emojis: ["🏙️", "🏜️", "🇦🇪"], title: "United Arab Emirates", alts: ["uae", "dubai"], difficulty: "medium" },
  { emojis: ["🥝", "🐑", "🇳🇿"], title: "New Zealand", alts: ["nz"], difficulty: "medium" },
  { emojis: ["🕌", "🌉", "🇹🇷"], title: "Turkey", alts: ["turkiye"], difficulty: "medium" },

  // --- Hard ---
  { emojis: ["🪆", "❄️", "🇷🇺"], title: "Russia", alts: [], difficulty: "hard" },
  { emojis: ["🌽", "⛰️", "🇵🇪"], title: "Peru", alts: [], difficulty: "hard" },
  { emojis: ["🥥", "🏝️", "🇵🇭"], title: "Philippines", alts: [], difficulty: "hard" },
  { emojis: ["⛰️", "🧣", "🇳🇵"], title: "Nepal", alts: [], difficulty: "hard" },
  { emojis: ["🍚", "🐅", "🇮🇩"], title: "Indonesia", alts: [], difficulty: "hard" },
  { emojis: ["🍺", "🏰", "🇨🇿"], title: "Czech Republic", alts: ["czechia"], difficulty: "hard" },
  { emojis: ["🧛", "🏰", "🇷🇴"], title: "Romania", alts: [], difficulty: "hard" },
  { emojis: ["🦒", "🦁", "🇰🇪"], title: "Kenya", alts: [], difficulty: "hard" },
  { emojis: ["🐪", "🕌", "🇲🇦"], title: "Morocco", alts: [], difficulty: "hard" },
  { emojis: ["🌊", "🌶️", "🇭🇺"], title: "Hungary", alts: [], difficulty: "hard" },
  { emojis: ["🧂", "🏜️", "🇧🇴"], title: "Bolivia", alts: [], difficulty: "hard" },
  { emojis: ["🌋", "🐢", "🇪🇨"], title: "Ecuador", alts: [], difficulty: "hard" },
  { emojis: ["☕", "💚", "🇨🇴"], title: "Colombia", alts: [], difficulty: "hard" },
  { emojis: ["🐴", "🥩", "🇺🇾"], title: "Uruguay", alts: [], difficulty: "hard" },
  { emojis: ["🧸", "🚲", "🇩🇰"], title: "Denmark", alts: [], difficulty: "hard" },
];

// --- Video Games: 3 emojis, title, alts, difficulty.
const VIDEO_GAMES = [
  // --- Easy ---
  { emojis: ["🍄", "👨‍🔧", "🏰"], title: "Super Mario Bros", alts: ["mario", "super mario"], difficulty: "easy" },
  { emojis: ["⛏️", "🟩", "🧟"], title: "Minecraft", alts: [], difficulty: "easy" },
  { emojis: ["🪂", "🔫", "🏝️"], title: "Fortnite", alts: [], difficulty: "easy" },
  { emojis: ["🦔", "💨", "💍"], title: "Sonic the Hedgehog", alts: ["sonic"], difficulty: "easy" },
  { emojis: ["👻", "🟡", "🕹️"], title: "Pac-Man", alts: ["pacman"], difficulty: "easy" },
  { emojis: ["🧱", "🟦", "⬇️"], title: "Tetris", alts: [], difficulty: "easy" },
  { emojis: ["🐦", "🟢", "🐷"], title: "Angry Birds", alts: [], difficulty: "easy" },
  { emojis: ["🍬", "🍭", "🔄"], title: "Candy Crush Saga", alts: ["candy crush"], difficulty: "easy" },
  { emojis: ["🗡️", "🧝", "🐔"], title: "The Legend of Zelda", alts: ["zelda"], difficulty: "easy" },
  { emojis: ["🏎️", "🍄", "🍌"], title: "Mario Kart", alts: [], difficulty: "easy" },
  { emojis: ["👊", "🦍", "🍌"], title: "Donkey Kong", alts: [], difficulty: "easy" },
  { emojis: ["⚽", "🎮", "🏆"], title: "FIFA", alts: ["ea sports fc"], difficulty: "easy" },
  { emojis: ["🚀", "🔪", "👤"], title: "Among Us", alts: [], difficulty: "easy" },
  { emojis: ["🏝️", "🦝", "💰"], title: "Animal Crossing", alts: [], difficulty: "easy" },
  { emojis: ["🌻", "🧟", "🔫"], title: "Plants vs Zombies", alts: [], difficulty: "easy" },

  // --- Medium ---
  { emojis: ["🤠", "🐴", "🌵"], title: "Red Dead Redemption", alts: ["rdr", "red dead"], difficulty: "medium" },
  { emojis: ["🚗", "🚓", "💰"], title: "Grand Theft Auto", alts: ["gta"], difficulty: "medium" },
  { emojis: ["🎯", "🔫", "🪖"], title: "Call of Duty", alts: ["cod"], difficulty: "medium" },
  { emojis: ["🐉", "📜", "⚔️"], title: "Skyrim", alts: ["the elder scrolls v skyrim", "elder scrolls"], difficulty: "medium" },
  { emojis: ["🌌", "🛸", "🪖"], title: "Halo", alts: [], difficulty: "medium" },
  { emojis: ["🏰", "🗡️", "🐗"], title: "The Witcher 3", alts: ["witcher 3", "the witcher"], difficulty: "medium" },
  { emojis: ["🧠", "🚪", "🎂"], title: "Portal", alts: [], difficulty: "medium" },
  { emojis: ["🧑‍🌾", "🌽", "🐔"], title: "Stardew Valley", alts: [], difficulty: "medium" },
  { emojis: ["🃏", "♠️", "💰"], title: "Balatro", alts: [], difficulty: "medium" },
  { emojis: ["🪓", "⚔️", "🧔"], title: "God of War", alts: ["gow"], difficulty: "medium" },
  { emojis: ["🔎", "👻", "🏚️"], title: "Luigi's Mansion", alts: ["luigis mansion"], difficulty: "medium" },
  { emojis: ["🌍", "🏗️", "👑"], title: "Civilization", alts: ["civ", "sid meiers civilization"], difficulty: "medium" },
  { emojis: ["🥋", "🩸", "💀"], title: "Mortal Kombat", alts: [], difficulty: "medium" },
  { emojis: ["🥊", "🐉", "🀄"], title: "Street Fighter", alts: [], difficulty: "medium" },
  { emojis: ["🤿", "🌊", "🐙"], title: "Subnautica", alts: [], difficulty: "medium" },

  // --- Hard ---
  { emojis: ["📦", "🪖", "🐍"], title: "Metal Gear Solid", alts: ["metal gear", "mgs"], difficulty: "hard" },
  { emojis: ["🐉", "🗡️", "🌫️"], title: "Dark Souls", alts: [], difficulty: "hard" },
  { emojis: ["🌆", "🧿", "🔫"], title: "Cyberpunk 2077", alts: ["cyberpunk"], difficulty: "hard" },
  { emojis: ["🐙", "🌊", "🏙️"], title: "BioShock", alts: [], difficulty: "hard" },
  { emojis: ["🍩", "🔫", "🤪"], title: "Borderlands", alts: [], difficulty: "hard" },
  { emojis: ["👽", "🟠", "🔫"], title: "Half-Life", alts: ["half life"], difficulty: "hard" },
  { emojis: ["🧑‍🚀", "🪐", "⛏️"], title: "No Man's Sky", alts: ["no mans sky"], difficulty: "hard" },
  { emojis: ["🕳️", "🔦", "👾"], title: "Doom", alts: [], difficulty: "hard" },
  { emojis: ["🧙", "💎", "🔥"], title: "Diablo", alts: [], difficulty: "hard" },
  { emojis: ["🗡️", "🌫️", "🔔"], title: "Elden Ring", alts: [], difficulty: "hard" },
  { emojis: ["🩸", "🕯️", "🐺"], title: "Bloodborne", alts: [], difficulty: "hard" },
  { emojis: ["🏙️", "🚧", "⚡"], title: "SimCity", alts: [], difficulty: "hard" },
  { emojis: ["🕵️", "🔫", "🎭"], title: "Hitman", alts: [], difficulty: "hard" },
  { emojis: ["🐜", "🌌", "📡"], title: "Outer Wilds", alts: [], difficulty: "hard" },
  { emojis: ["🧑‍🚀", "🔫", "😱"], title: "Dead Space", alts: [], difficulty: "hard" },
];

// --- Mashup: EXACTLY 2 emojis, each one part of a compound word or short
// two-word phrase; together they make the answer. Different reveal (2
// stages) and scoring (see MASHUP_STAGE_MULTIPLIER). normalize() already
// collapses spaces and hyphens, so "star ship"/"starship"/"star-ship" all
// match — alts just make that explicit.
const MASHUPS = [
  // --- Easy ---
  { emojis: ["⭐", "🚢"], title: "starship", alts: ["star ship"], difficulty: "easy" },
  { emojis: ["🌞", "🌻"], title: "sunflower", alts: ["sun flower"], difficulty: "easy" },
  { emojis: ["🔥", "🧱"], title: "firewall", alts: ["fire wall"], difficulty: "easy" },
  { emojis: ["🥶", "👣"], title: "cold feet", alts: ["coldfeet"], difficulty: "easy" },
  { emojis: ["🌧️", "🏹"], title: "rainbow", alts: ["rain bow"], difficulty: "easy" },
  { emojis: ["🦶", "⚽"], title: "football", alts: ["foot ball"], difficulty: "easy" },
  { emojis: ["👁️", "🏀"], title: "eyeball", alts: ["eye ball"], difficulty: "easy" },
  { emojis: ["🔑", "🕳️"], title: "keyhole", alts: ["key hole"], difficulty: "easy" },
  { emojis: ["🌙", "💡"], title: "moonlight", alts: ["moon light"], difficulty: "easy" },
  { emojis: ["🦷", "🖌️"], title: "toothbrush", alts: ["tooth brush"], difficulty: "easy" },
  { emojis: ["🔥", "🚒"], title: "fire truck", alts: ["firetruck"], difficulty: "easy" },
  { emojis: ["⭐", "🐟"], title: "starfish", alts: ["star fish"], difficulty: "easy" },
  { emojis: ["🌊", "🐎"], title: "seahorse", alts: ["sea horse"], difficulty: "easy" },
  { emojis: ["🔦", "🏠"], title: "lighthouse", alts: ["light house"], difficulty: "easy" },
  { emojis: ["🐄", "👦"], title: "cowboy", alts: ["cow boy"], difficulty: "easy" },
  { emojis: ["💧", "🍉"], title: "watermelon", alts: ["water melon"], difficulty: "easy" },
  { emojis: ["🕷️", "🕸️"], title: "spiderweb", alts: ["spider web"], difficulty: "easy" },
  { emojis: ["🥵", "🐕"], title: "hot dog", alts: ["hotdog"], difficulty: "easy" },
  { emojis: ["🌞", "🕶️"], title: "sunglasses", alts: ["sun glasses"], difficulty: "easy" },
  { emojis: ["🔵", "🫐"], title: "blueberry", alts: ["blue berry"], difficulty: "easy" },

  // --- Medium ---
  { emojis: ["🧠", "🌩️"], title: "brainstorm", alts: ["brain storm"], difficulty: "medium" },
  { emojis: ["🕰️", "⚙️"], title: "clockwork", alts: ["clock work"], difficulty: "medium" },
  { emojis: ["📰", "📄"], title: "newspaper", alts: ["news paper"], difficulty: "medium" },
  { emojis: ["🌧️", "🧥"], title: "raincoat", alts: ["rain coat"], difficulty: "medium" },
  { emojis: ["🌽", "🍞"], title: "cornbread", alts: ["corn bread"], difficulty: "medium" },
  { emojis: ["🐴", "👞"], title: "horseshoe", alts: ["horse shoe"], difficulty: "medium" },
  { emojis: ["💧", "🍂"], title: "waterfall", alts: ["water fall"], difficulty: "medium" },
  { emojis: ["🥚", "🌱"], title: "eggplant", alts: ["egg plant"], difficulty: "medium" },
  { emojis: ["🐷", "🏦"], title: "piggy bank", alts: ["piggybank"], difficulty: "medium" },
  { emojis: ["🌞", "🔥"], title: "sunburn", alts: ["sun burn"], difficulty: "medium" },
  { emojis: ["📚", "🐛"], title: "bookworm", alts: ["book worm"], difficulty: "medium" },
  { emojis: ["🔑", "🪵"], title: "keyboard", alts: ["key board"], difficulty: "medium" },
  { emojis: ["🧈", "🪰"], title: "butterfly", alts: ["butter fly"], difficulty: "medium" },
  { emojis: ["🥛", "🥤"], title: "milkshake", alts: ["milk shake"], difficulty: "medium" },
  { emojis: ["🌊", "🌿"], title: "seaweed", alts: ["sea weed"], difficulty: "medium" },
  { emojis: ["❄️", "🏀"], title: "snowball", alts: ["snow ball"], difficulty: "medium" },
  { emojis: ["🌊", "🐚"], title: "seashell", alts: ["sea shell"], difficulty: "medium" },
  { emojis: ["👂", "💍"], title: "earring", alts: ["ear ring"], difficulty: "medium" },
  { emojis: ["🚗", "🏊"], title: "carpool", alts: ["car pool"], difficulty: "medium" },
  { emojis: ["🧀", "🍔"], title: "cheeseburger", alts: ["cheese burger"], difficulty: "medium" },
  { emojis: ["🖤", "🐦"], title: "blackbird", alts: ["black bird"], difficulty: "medium" },
  { emojis: ["🏠", "🪰"], title: "housefly", alts: ["house fly"], difficulty: "medium" },
  { emojis: ["✋", "👜"], title: "handbag", alts: ["hand bag"], difficulty: "medium" },
  { emojis: ["🌙", "🚶"], title: "moonwalk", alts: ["moon walk"], difficulty: "medium" },

  // --- Hard ---
  { emojis: ["🍯", "🌙"], title: "honeymoon", alts: ["honey moon"], difficulty: "hard" },
  { emojis: ["🦅", "👁️"], title: "eagle eye", alts: ["eagleeye"], difficulty: "hard" },
  { emojis: ["🎂", "🚶"], title: "cakewalk", alts: ["cake walk"], difficulty: "hard" },
  { emojis: ["🧠", "🥶"], title: "brain freeze", alts: ["brainfreeze"], difficulty: "hard" },
  { emojis: ["🍞", "🏆"], title: "breadwinner", alts: ["bread winner"], difficulty: "hard" },
  { emojis: ["🔦", "🏋️"], title: "lightweight", alts: ["light weight"], difficulty: "hard" },
  { emojis: ["✋", "📖"], title: "handbook", alts: ["hand book"], difficulty: "hard" },
  { emojis: ["🌊", "🦁"], title: "sea lion", alts: ["sealion"], difficulty: "hard" },
  { emojis: ["🐟", "🪝"], title: "fishhook", alts: ["fish hook"], difficulty: "hard" },
  { emojis: ["🟢", "🏠"], title: "greenhouse", alts: ["green house"], difficulty: "hard" },
  { emojis: ["🔥", "🦊"], title: "firefox", alts: ["fire fox"], difficulty: "hard" },
  { emojis: ["🦶", "🖨️"], title: "footprint", alts: ["foot print"], difficulty: "hard" },
  { emojis: ["🐈", "😴"], title: "cat nap", alts: ["catnap"], difficulty: "hard" },
  { emojis: ["🧊", "🎲"], title: "ice cube", alts: ["icecube"], difficulty: "hard" },
];

const BANKS = {
  movies: MOVIES,
  tv: TV_SHOWS,
  countries: COUNTRIES,
  "video-games": VIDEO_GAMES,
  mashup: MASHUPS,
};

// Host-facing category list (order = pick order in setup).
export const CATEGORIES = [
  { key: "movies", name: "Movies" },
  { key: "tv", name: "TV Shows" },
  { key: "countries", name: "Countries" },
  { key: "video-games", name: "Video Games" },
  { key: "mashup", name: "Mashup" },
];
const CATEGORY_NAME = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.name]));

// Built-in category keys + display names an AI "Custom Theme" can't shadow.
export const AI_CONTENT_RESERVED = [
  ...CATEGORIES.map((c) => c.name),
  ...CATEGORIES.map((c) => c.key),
];

export const id = "emoji-movie";
export const name = "Crack the Code";
export const minPlayers = 2;

export const DIFFICULTY_MODES = ["easy", "medium", "hard", "mixed"];

// Emojis are revealed one at a time. Emoji 1 is up from the start; each
// later emoji appears REVEAL_INTERVAL_MS after the previous one. With three
// emojis and a 6s step, everything is on screen by 12s; ANSWER_MS leaves a
// comfortable window to keep guessing after the last reveal.
const REVEAL_INTERVAL_MS = 6_000;
const ANSWER_MS = 30_000;

// Scoring. A correct guess is BASE_POINTS shaped by three factors:
//   * stage      — how many emojis were showing when it landed (the big one)
//   * difficulty — harder movies are worth more (matters most in "mixed")
//   * speed      — a mild nudge so faster is always a little better
// never dropping below MIN_POINTS.
const BASE_POINTS = 1000;
const MIN_POINTS = 50;
const STAGE_MULTIPLIER = { 1: 1.0, 2: 0.6, 3: 0.3 };
// Mashup entries only have 2 emojis, so a 2-stage curve: guessing off the
// first emoji alone pays full; after both are shown you're on base points.
const MASHUP_STAGE_MULTIPLIER = { 1: 1.0, 2: 0.45 };
const DIFFICULTY_WEIGHT = { easy: 1.0, medium: 1.4, hard: 1.8 };
const SPEED_FLOOR = 0.75; // speed factor runs 1.0 (instant) -> 0.75 (buzzer)

// Lowercase, strip accents, turn "&" into "and", drop everything that
// isn't a letter or digit, then drop a leading "the". So "The Dark-Knight",
// "the dark knight" and "THEDARKKNIGHT" all collapse to "darkknight".
function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining accent marks
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "")
    .replace(/^the/, "");
}

// Classic Levenshtein edit distance between two short strings.
function editDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

// Lenient match: exact after normalizing (which already strips spaces and
// hyphens, so "star ship" == "starship" == "star-ship"), or within a small
// edit distance that grows with answer length. Checked against the title
// and any alts.
function isCorrectGuess(rawGuess, entry) {
  const guess = normalize(rawGuess);
  if (guess.length < 2) return false;

  const targets = [entry.title, ...(entry.alts ?? [])].map(normalize).filter(Boolean);
  for (const target of targets) {
    if (guess === target) return true;
    const tolerance = target.length <= 3 ? 0 : target.length <= 6 ? 1 : 2;
    if (tolerance > 0 && editDistance(guess, target) <= tolerance) return true;
  }
  return false;
}

// How many emojis are showing `atMs`. Emoji 1 from the start, then one more
// every REVEAL_INTERVAL_MS, capped at the entry's emoji count (3 normally,
// 2 for Mashup — which makes Mashup a natural 2-stage reveal).
function revealedCountAt(entry, roundStartedAt, atMs) {
  const elapsed = atMs - roundStartedAt;
  if (elapsed <= 0) return 1;
  return Math.min(entry.emojis.length, 1 + Math.floor(elapsed / REVEAL_INTERVAL_MS));
}

// Points for a correct guess, given when it landed (elapsedMs), how many
// emojis were revealed at that moment, and the entry (its difficulty and
// whether it's a 2-emoji Mashup, which uses its own stage curve).
function pointsFor(elapsedMs, revealedAtGuess, entry) {
  const table = entry.category === "mashup" ? MASHUP_STAGE_MULTIPLIER : STAGE_MULTIPLIER;
  const stage = table[revealedAtGuess] ?? table[entry.emojis.length];
  const weight = DIFFICULTY_WEIGHT[entry.difficulty] ?? 1.0;
  const remainingFraction = Math.max(0, Math.min(1, 1 - elapsedMs / ANSWER_MS));
  const speed = SPEED_FLOOR + (1 - SPEED_FLOOR) * remainingFraction;
  return Math.max(MIN_POINTS, Math.round(BASE_POINTS * weight * stage * speed));
}

// The host picks how many rounds, a difficulty mode, and which categories
// to include. Entries are drawn up front from a shuffled copy of the
// combined pool of the enabled banks (optionally filtered by difficulty),
// so none repeats within a game — and the session-level no-repeat memory
// keys on category+title so a second game keeps going through the pool.
// If the filtered pool has fewer entries than the requested round count,
// the game just runs fewer rounds.
export function createGame(playerIds, { rounds, difficulty, categories, memory, customThemes = [] }) {
  const requested = Number(rounds);
  if (!Number.isInteger(requested) || requested < 1) {
    throw new Error("Choose how many rounds to play.");
  }

  const mode = String(difficulty ?? "mixed");
  if (!DIFFICULTY_MODES.includes(mode)) {
    throw new Error("Choose a difficulty.");
  }

  // Built-in banks + this room's AI custom themes, keyed the same way. A
  // custom theme name IS its key (as it appears in `categories`).
  const banks = { ...BANKS };
  for (const theme of customThemes) {
    if (theme?.name && Array.isArray(theme.entries) && theme.entries.length) {
      banks[theme.name] = theme.entries;
    }
  }

  const catKeys = (Array.isArray(categories) ? categories : ["movies"]).filter(
    (c) => c in banks
  );
  if (catKeys.length === 0) {
    throw new Error("Pick at least one category.");
  }

  const pool = [];
  for (const cat of catKeys) {
    const bank = mode === "mixed" ? banks[cat] : banks[cat].filter((e) => e.difficulty === mode);
    for (const entry of bank) pool.push({ ...entry, category: cat });
  }
  if (pool.length === 0) {
    throw new Error("No entries available for those categories at that difficulty.");
  }

  const totalRounds = Math.min(requested, pool.length);
  const { items, seenKeys } = drawWithoutRepeats(
    pool,
    totalRounds,
    memory?.seen ?? [],
    (e) => `${e.category}|${e.title}`
  );
  const now = Date.now();

  return {
    id,
    phase: "guess", // "guess" -> "reveal" -> ("guess" ...) -> "final"
    difficultyMode: mode,
    categories: catKeys,
    totalRounds,
    roundIndex: 0,
    entries: items,
    deckMemory: { seen: seenKeys }, // server-only; harvested by index.js
    roundStartedAt: now,
    deadline: now + ANSWER_MS,
    answers: new Map(), // playerId -> { guess, correct, elapsedMs, revealedAtGuess }, current round only
    scores: new Map(playerIds.map((pid) => [pid, 0])),
    lastResult: null, // filled in by revealRound()
  };
}

// Record a guess. A WRONG guess is free and non-locking — players keep
// guessing as more emojis appear. A CORRECT guess locks the player in for
// the round at the stage/time it landed. Returns a small ack so the
// guesser's own device can show the outcome (the server owns the fuzzy
// matching, not the client).
export function submitAnswer(game, playerId, rawGuess, presentPlayerIds) {
  if (game.phase !== "guess") return { correct: false };
  if (Date.now() > game.deadline + 1000) return { correct: false, tooLate: true };

  const entry = game.entries[game.roundIndex];

  const prev = game.answers.get(playerId);
  if (prev?.correct) {
    return {
      correct: true,
      lockedIn: true,
      alreadyLocked: true,
      revealedAtGuess: prev.revealedAtGuess,
      points: pointsFor(prev.elapsedMs, prev.revealedAtGuess, entry),
    };
  }

  const guess = String(rawGuess ?? "").slice(0, 100).trim();
  const now = Date.now();
  const correct = isCorrectGuess(guess, entry);
  const elapsedMs = Math.max(0, now - game.roundStartedAt);
  const revealedAtGuess = revealedCountAt(entry, game.roundStartedAt, now);
  game.answers.set(playerId, { guess, correct, elapsedMs, revealedAtGuess });

  if (correct) {
    const everyoneSolved = presentPlayerIds.every((pid) => game.answers.get(pid)?.correct);
    if (everyoneSolved) revealRound(game, presentPlayerIds);
    return {
      correct: true,
      lockedIn: true,
      revealedAtGuess,
      points: pointsFor(elapsedMs, revealedAtGuess, entry),
    };
  }
  return { correct: false };
}

// Score the round (correct answers are worth the most when locked in early
// with few emojis; wrong or missing answers are worth 0) and freeze a
// per-player breakdown for the reveal screen — earliest lock-in first,
// then fastest.
export function revealRound(game, presentPlayerIds) {
  if (game.phase !== "guess") return;

  const entry = game.entries[game.roundIndex];
  const rows = presentPlayerIds.map((pid) => {
    const answer = game.answers.get(pid);
    const points = answer?.correct
      ? pointsFor(answer.elapsedMs, answer.revealedAtGuess, entry)
      : 0;
    if (points) game.scores.set(pid, (game.scores.get(pid) ?? 0) + points);
    return {
      playerId: pid,
      guess: answer?.guess ?? "",
      correct: Boolean(answer?.correct),
      points,
      elapsedMs: answer?.elapsedMs ?? null,
      revealedAtGuess: answer?.revealedAtGuess ?? null,
    };
  });

  rows.sort((a, b) => {
    if (a.correct !== b.correct) return a.correct ? -1 : 1;
    if (!a.correct) return 0;
    if (a.revealedAtGuess !== b.revealedAtGuess) return a.revealedAtGuess - b.revealedAtGuess;
    return a.elapsedMs - b.elapsedMs;
  });

  game.lastResult = {
    roundIndex: game.roundIndex,
    title: entry.title,
    emojis: entry.emojis,
    difficulty: entry.difficulty,
    category: entry.category,
    categoryName: CATEGORY_NAME[entry.category] ?? "",
    entries: rows,
  };
  game.phase = "reveal";
}

// Optional framework hook: called when the connected-player set changes.
// If everyone still connected has already locked in a correct guess, end
// the round now instead of waiting on a player who left.
export function reconcilePresence(game, presentPlayerIds) {
  if (game.phase !== "guess") return;
  if (presentPlayerIds.length === 0) return;
  if (presentPlayerIds.every((pid) => game.answers.get(pid)?.correct)) {
    revealRound(game, presentPlayerIds);
  }
}

// Host "Force proceed": reveal the movie now. Anyone who hadn't locked in
// a correct guess just scores 0 for the round.
export function forceAdvance(game, presentPlayerIds) {
  if (game.phase === "guess") revealRound(game, presentPlayerIds);
}

export function nextRound(game) {
  if (game.phase !== "reveal") return;

  if (game.roundIndex + 1 >= game.totalRounds) {
    game.phase = "final";
    return;
  }
  game.roundIndex += 1;
  game.answers = new Map();
  game.roundStartedAt = Date.now();
  game.deadline = Date.now() + ANSWER_MS;
  game.phase = "guess";
}

// The PUBLIC view — identical for every player. During the guess phase only
// the emojis revealed SO FAR are sent (the hidden ones never leave the
// server until their time comes, so they can't be peeked at); the reveal
// screen gets the full set. Typed guesses stay private until the reveal.
export function getPublicState(game, presentPlayerIds) {
  const entry = game.entries[game.roundIndex];
  const scores = presentPlayerIds
    .map((pid) => ({ playerId: pid, score: game.scores.get(pid) ?? 0 }))
    .sort((a, b) => b.score - a.score);

  const now = Date.now();
  const revealedCount =
    game.phase === "guess"
      ? revealedCountAt(entry, game.roundStartedAt, now)
      : entry.emojis.length;

  const state = {
    id: game.id,
    phase: game.phase,
    difficultyMode: game.difficultyMode,
    currentDifficulty: entry.difficulty,
    category: entry.category,
    categoryName: CATEGORY_NAME[entry.category] ?? "",
    roundIndex: game.roundIndex,
    totalRounds: game.totalRounds,
    emojis: entry.emojis.slice(0, revealedCount),
    revealedCount,
    totalEmojis: entry.emojis.length,
    revealIntervalMs: REVEAL_INTERVAL_MS,
    solvedCount: presentPlayerIds.filter((pid) => game.answers.get(pid)?.correct).length,
    totalPlayers: presentPlayerIds.length,
    answerMs: ANSWER_MS,
    msLeft: Math.max(0, game.deadline - now),
    scores,
  };

  if (game.phase === "reveal") {
    state.result = game.lastResult;
  }

  if (game.phase === "final") {
    const top = scores.length ? scores[0].score : 0;
    state.winnerIds =
      top > 0 ? scores.filter((s) => s.score === top).map((s) => s.playerId) : [];
  }

  return state;
}

// No per-player secret data — everyone sees the same thing. The framework
// still calls this once when the game starts; returning null is fine.
export function getPrivateState() {
  return null;
}

// --- Tournament Mode: default per-game config when run inside a tournament.
export function tournamentOptions() {
  return {
    rounds: 4,
    difficulty: "mixed",
    categories: ["movies", "tv", "countries", "video-games", "mashup"],
  };
}
