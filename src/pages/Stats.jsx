import React, { useState, useEffect } from 'react';
import { Box, Flex, Heading, Text, Spinner, AspectRatio, Image  } from '@chakra-ui/react';
import { supabase } from '../api/supabaseClient';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { scaleSequential } from 'd3-scale';
import { interpolateBlues, interpolateRainbow } from 'd3-scale-chromatic';
import { geoCentroid } from 'd3-geo';
import countries from 'i18n-iso-countries';
import huLocale from 'i18n-iso-countries/langs/hu.json';
import enLocale from 'i18n-iso-countries/langs/en.json';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

// Register Hungarian and English locales for country translations
countries.registerLocale(huLocale);
countries.registerLocale(enLocale);

// TopoJSON URL
const geoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

const Stats = () => {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userColors, setUserColors] = useState({});
  const [orderedBookIds, setOrderedBookIds] = useState([]);
  //Books
  const spineHeight = 200          // must match BookSpine’s height
  const verticalMargin = 4         // m={1} → 4px top + bottom
  const shelfGap = 2               // space between bottom of spine and shelf
  const shelfThickness = 6         // how tall the shelf line is
  const rowHeight = spineHeight + verticalMargin * 2
  const cycleHeight = rowHeight + shelfGap + shelfThickness

  useEffect(() => {
    async function loadAll() {
      // 1) fetch books (including id)
      const { data: booksData, error: bookErr } = await supabase
        .from('books')
        .select('id, title, author, cover_url, country, release_year, author_gender, genre, page_count')
        .eq('is_selected', true);
      if (bookErr) console.error(bookErr);
      else setBooks(booksData || []);

      // 2) get user
      const {
        data: { user },
        error: userErr
      } = await supabase.auth.getUser();
      if (userErr) {
        console.error(userErr);
        setLoading(false);
        return;
      }

      // 3) fetch mood colors
      const { data: ub, error: ubErr } = await supabase
        .from('user_books')
        .select('book_id, mood_color')
        .eq('user_id', user.id);
      if (ubErr) console.error(ubErr);
      else setUserColors(Object.fromEntries(ub.map(u => [u.book_id, u.mood_color])));

      // 3a) fetch past meetings (where is_selected was true) so we know their read dates
      const { data: pastMeetings = [], error: meetErr } = await supabase
        .from('meetings')
        .select('book_id, date')
        .eq('is_active', false)
        .order('date', { ascending: true });  // oldest → newest
      if (meetErr) console.error('Failed to load past meetings', meetErr);

      // 3b) build an array of book IDs in read order
      const orderedIds = pastMeetings.map(m => m.book_id);

      // now you have both `booksData` (all selected books) and `orderedIds`
      setOrderedBookIds(orderedIds);

      // finally:
      setLoading(false);
    }
    loadAll();
  }, []);

  if (loading) {
    return (
      <Flex justify="center" align="center" height="100vh">
        <Spinner size="xl" />
      </Flex>
    );
  }

  // Aggregations
  const timelineData = Object.entries(
    books.reduce((acc, { release_year }) => {
      acc[release_year] = (acc[release_year] || 0) + 1;
      return acc;
    }, {})
  )
    .map(([year, count]) => ({ year: +year, count }))
    .sort((a, b) => a.year - b.year);

  const genreData = Object.entries(
    books.reduce((acc, { genre }) => {
      if (Array.isArray(genre)) genre.forEach(g => (acc[g] = (acc[g] || 0) + 1));
      return acc;
    }, {})
  ).map(([genre, count]) => ({ genre, count }));
  const maxGenre = Math.max(0, ...genreData.map(d => d.count));

  // Map constants
  const boxSize = 100;         // increased from 40 to 100 for larger covers
  const offset = 50;          // increased offset for larger boxes

  const maxPages = books.length
    ? Math.max(...books.map(b => b.page_count))
    : 0;

  const orderedBooks = [
    ...orderedBookIds
      .map(id => books.find(b => b.id === id))
      .filter(Boolean),
    ...books.filter(b => !orderedBookIds.includes(b.id))
  ];

  const femaleBooks = books.filter(b => b.author_gender === 'nő')
  const maleBooks   = books.filter(b => b.author_gender === 'férfi')
  const genderSummary = [
    { name: 'nő',   value: femaleBooks.length },
    { name: 'férfi', value: maleBooks.length },
  ]

  // Enhanced BookSpine with intelligent title wrapping
  const BookSpine = ({ book, maxPages, moodColor  }) => {
    const widthPx = maxPages
      ? (book.page_count / maxPages) * 200
      : 0;
    const coverHeight = 200;
    const gap = 8;
    
    console.log('BookSpine debug:', book.id, 'widthPx:', widthPx, 'moodColor:', moodColor);

    // Shorten author name
    const nameParts = (book.author || '').split(' ');
    let displayAuthor;
    if (nameParts.length >= 3) {
      const initials = nameParts
        .slice(0, -1)
        .map(n => n.charAt(0).toUpperCase() + '.')
        .join(' ');
      displayAuthor = `${initials} ${nameParts[nameParts.length - 1]}`;
    } else if (nameParts.length === 2) {
      displayAuthor = `${nameParts[0].charAt(0).toUpperCase()}. ${nameParts[1]}`;
    } else {
      displayAuthor = book.author;
    }

    // Wrap title into lines of ~12 characters
    const words = book.title.split(' ');
    const lines = [];
    let current = '';
    words.forEach(w => {
      if ((current + ' ' + w).trim().length > 20) {
        lines.push(current.trim());
        current = w;
      } else {
        current += current ? ' ' + w : w;
      }
    });

    if (current) lines.push(current.trim());

    return (
      <Box
        width={`${widthPx}px`}
        height={`${coverHeight}px`}
        bg={moodColor ? `#${moodColor}` : 'gray.200'}
        border={moodColor === 'ffffff' ? '1px solid black' : 'none'}
        m={1}
        position="relative"
        borderRadius="md"
      >
        {/* spines */}
        <Box position="absolute" left="4px" top={`${gap}px`} bottom={`${gap}px`} width="2px" bg="black" />
        <Box position="absolute" right="4px" top={`${gap}px`} bottom={`${gap}px`} width="2px" bg="black" />

        {/* author + title vertical */}
        <Flex
          direction="column"
          align="center"
          justify="center"
          position="absolute"
          top="50%"
          left="50%"
          transform="translate(-50%, -50%) rotate(-90deg)"
          width={`${coverHeight - gap * 2}px`}
        >
          <Text fontSize="xs" whiteSpace="nowrap">
            {displayAuthor}
          </Text>
          {lines.map((line, i) => (
            <Text key={i} fontSize="xs" fontWeight="bold" textAlign="center">
              {line}
            </Text>
          ))}
        </Flex>

        {/* page count */}
        <Box
          position="absolute"
          bottom="4px"
          left="50%"
          transform="translateX(-50%)"
          textAlign="center"
          fontSize="xs"
        >
          <Text>{book.page_count}</Text>
          <Text>oldal</Text>
        </Box>
      </Box>
    );
  };

  return (
    <Box p={6}>
      {/* 1. Map with book covers and leader lines */}
      <Box mb={4} position="relative" overflow="visible" justifyItems={"center"}>
        <Flex w="100%" mb={2} align="center" justify="center">
          <Heading size="xl">Országok, ahol "jártunk"</Heading>
        </Flex>
        <AspectRatio ratio={4 / 3} width={{base:"100%", md:"80%"}} height="80%">
          <ComposableMap projectionConfig={{ rotate: [-10, 0, 0], scale: 147 }}>
            <Geographies geography={geoUrl}>
              {({ geographies, projection }) => (
                <>
                  {geographies.map(geo => (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill="#EEE"
                      stroke="#607D8B"
                    />
                  ))}
                  {books.map((book, i) => {
                    // automatic ISO-based translation
                    const countryCode = countries.getAlpha2Code(book.country, 'hu') || countries.getAlpha2Code(book.country, 'en');
                    const isoName = countryCode ? countries.getName(countryCode, 'en') : undefined;
                    const normalizationMap = {
                      'Erdély': 'Romania',
                      'Magyarország': 'Hungary',
                      'Dél-Korea': 'South Korea',
                      'Amerika': 'United States of America',
                      'Belgium': 'Belgium',
                      'Románia': 'Romania',
                      'Norvégia': 'Norway',
                      'Algéria': 'Algeria',
                      'Anglia': 'United Kingdom',
                      'Tajvan': 'Taiwan',
                      'Spanyolország': 'Spain',
                      'Japán': 'Japan',
                      'Oroszország': 'Russia',
                      'Lengyelország': 'Poland',
                      'Mezopotámia': 'Iraq',
                      'Németország': 'Germany',
                      'Olaszország': 'Italy',
                      'Dánia': 'Denmark',
                      'Ausztrália': 'Australia'
                    };
                    // determine initial nameKey
                    let nameKey = isoName || normalizationMap[book.country] || book.country;
                    // attempt auto match
                    let match = geographies.find(
                      geo => geo.properties.name === nameKey
                    );
                    // fallback to manual if no match
                    if (!match) {
                      const fallback = normalizationMap[book.country];
                      if (fallback && fallback !== nameKey) {
                        nameKey = fallback;
                        match = geographies.find(
                          geo => geo.properties.name === nameKey
                        );
                      }
                    }
                    console.log('Debug: book', book.title, 'country:', book.country, '-> nameKey:', nameKey);
                    console.log('Debug: available topo countries:', geographies.map(g => g.properties.name));(
                      geo => geo.properties.name === nameKey
                    );
                    if (!match) {
                      console.warn(`Debug: No geography match for country nameKey: ${nameKey}`);
                      return null;
                    }
                    console.log(`Debug: Matched geography for ${nameKey}`, match);
                    const centroid = geoCentroid(match);
                    return (
                      <Marker key={`marker-${i}`} coordinates={centroid}>
                        <line
                          x1={0}
                          y1={0}
                          x2={offset}
                          y2={-offset}
                          stroke="gray"
                          strokeWidth={1}
                        />
                        <rect
                          x={offset}
                          y={-offset - boxSize / 2}
                          width={boxSize}
                          height={boxSize}
                          fill="white"
                          stroke="gray"
                          rx={4}
                        />
                        <image
                          xlinkHref={book.cover_url}
                          x={offset}
                          y={-offset - boxSize / 2}
                          width={boxSize}
                          height={boxSize}
                          preserveAspectRatio="xMidYMid slice"
                        />
                      </Marker>
                    );
                  })}
                </>
              )}
            </Geographies>
          </ComposableMap>
        </AspectRatio>
      </Box>

      {/* 2. Custom timeline */}
      <Box mb={10} position="relative" height="350px">
        <Flex w="100%" mb={4} align="center" justify="center">
          <Heading size="xl">Az Idővonalunk</Heading>
        </Flex>
        
        <Flex>
          {/* axis with arrow */}
          <Box position="absolute" top="53.2%" left="4%" right="4%" height="4px" bg="gray.300">
            <Box
              as="svg"
              position="absolute"
              right="-6px"
              top="-4px"
              width="12px"
              height="12px"
              viewBox="0 0 12 12"
            >
              <path d="M0,0 L12,6 L0,12" fill="gray" />
            </Box>
          </Box>

          {(() => {
            const years = timelineData.map(d => d.year);
            const minYear = Math.min(...years) - 10;
            const maxYear = Math.max(...years) + 10;
            const range = maxYear - minYear;
            const dotGap = 4; // small offset from axis

            return timelineData.map(({ year, count }, idx) => {
              const pct = 4 + ((year - minYear) / range) * 92;
              const left = `${pct}%`;
              const size = Math.sqrt(count) * 8;

              return (
                <Box
                  key={year}
                  position="absolute"
                  left={left}
                  top={`calc(55% - ${size/2 + dotGap}px)`}
                  width={`${size}px`}
                  height={`${size}px`}
                  bg="blue.500"
                  borderRadius="50%"
                  transform="translateX(-50%)"
                />
              );
            });
          })()}

          {(() => {
            const years = timelineData.map(d => d.year);
            const minYear = Math.min(...years) - 10;
            const maxYear = Math.max(...years) + 10;
            const range = maxYear - minYear;
            const coverHeight = 120;
            const gap = 20; // distance between axis and cover
            return timelineData.flatMap(({ year }, idx) => {
              const pct = 4 + ((year - minYear) / range) * 92;
              const left = `${pct}%`;
              const booksYear = books.filter(b => b.release_year === year);
              const above = idx % 2 === 0;

              return booksYear.map((book, j) => {
                // position first cover gap pixels away
                const yOffset = above
                  ? -(coverHeight + gap) * (j + 1)
                  : gap + j * (coverHeight + gap);

                return (
                  <Box
                    key={`${year}-${j}`}
                    position="absolute"
                    left={left}
                    top={`calc(55% + ${yOffset}px)`}
                    transform="translateX(-50%)"
                    width="80px"
                    height={`${coverHeight}px`}
                  >
                    {/* leader line spanning exactly between axis and cover */}
                    <Box
                      position="absolute"
                      left="50%"
                      top={above ? `100%` : `-${gap}px`}
                      width="2px"
                      height={`${gap}px`}
                      bg="gray.500"
                      transform="translateX(-50%)"
                    />

                    {/* cover image */}
                    <Box
                      as="img"
                      src={book.cover_url}
                      width="100%"
                      height="100%"
                      objectFit="cover"
                      boxShadow="md"
                    />

                    {/* year label just outside the cover */}
                    <Text
                      position="absolute"
                      left="50%"
                      top={above ? `-26px` : `calc(100% + ${gap - 10}px)`}
                      transform="translateX(-50%)"
                      fontSize="sm"
                    >
                      {year}
                    </Text>
                  </Box>
                );
              });
            });
          })()}
        </Flex>
      </Box>

      {/* Hány női és férfi szerzőt olvastunk? */}
      <Flex direction="column" align="center" mb={10} px={4}>
        <Heading size="xl" mb={6} textAlign="center">
          Hány női és férfi szerzőt olvastunk?
        </Heading>

        <Flex
          direction={{ base: "column", md: "row" }}
          align="center"
          justify="center"
          w="100%"
        >
          {/* Pie */}
          <Box flexShrink={0}>
            <ResponsiveContainer width={200} height={200}>
              <PieChart>
                <Pie
                  data={genderSummary}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  startAngle={90}
                  endAngle={-270}
                  labelLine={false}
                  label={false}
                >
                  <Cell key="nő" fill="#F2B3E5" />
                  <Cell key="férfi" fill="#B3DFF2" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </Box>

          {/* Cover boxes */}
          <Flex
            direction="column"
            ml={{ base: 0, md: 8 }}
            mt={{ base: 6, md: 0 }}
            w={{ base: "100%", md: "auto" }}
            maxW={{ base: "360px", md: "none" }}
            gap={4}
          >
            {/* nő */}
            <Box
              bg="#F2B3E5"
              p={4}
              borderRadius="md"
              boxShadow="sm"
              w="100%"
            >
              <Flex wrap="wrap" justify="center" gap={2}>
                {femaleBooks.map((book) => (
                  <Box
                    as="img"
                    key={book.id}
                    src={book.cover_url}
                    boxSize={{ base: "40px", sm: "60px", md: "80px" }}
                    objectFit="cover"
                    borderRadius="md"
                  />
                ))}
              </Flex>
            </Box>

            {/* férfi */}
            <Box
              bg="#B3DFF2"
              p={4}
              borderRadius="md"
              boxShadow="sm"
              w="100%"
            >
              <Flex wrap="wrap" justify="center" gap={2}>
                {maleBooks.map((book) => (
                  <Box
                    as="img"
                    key={book.id}
                    src={book.cover_url}
                    boxSize={{ base: "40px", sm: "60px", md: "80px" }}
                    objectFit="cover"
                    borderRadius="md"
                  />
                ))}
              </Flex>
            </Box>
          </Flex>
        </Flex>
      </Flex>

      {/* 3. Genre distribution with pastel colors and cover thumbnails */}
      <Box mb={10}>
        <Flex w="100%" mb={4} align="center" justify="center">
          <Heading size="xl">Milyen műfajokat olvasunk?</Heading>
        </Flex>
        <Flex direction="column" gap={2}>
          {genreData.map(({ genre, count }, i) => {
            const widthPct = maxGenre > 0 ? (count / maxGenre) * 100 : 0;
            const pastelPalette = [
              '#F8BBD0', '#B2DFDB', '#FFE0B2', '#D1C4E9',
              '#C8E6C9', '#FFCCBC', '#E1F5FE', '#F0F4C3'
            ];
            const bgColor = pastelPalette[i % pastelPalette.length];
            const booksInGenre = books.filter(b => Array.isArray(b.genre) && b.genre.includes(genre));

            return (
              <Flex key={genre} align="center">
                <Box
                  width={`${widthPct}%`}
                  bg={bgColor}
                  p={3}
                  borderRadius="md"
                >
                  <Flex>
                    {booksInGenre.map((book, idx) => (
                      <Box
                        key={idx}
                        as="img"
                        src={book.cover_url}
                        boxSize="24px"
                        borderRadius="full"
                        objectFit="cover"
                        mr={1}
                      />
                    ))}
                  </Flex>
                </Box>
                <Text ml={4} fontWeight="bold" color="gray.800">
                  {genre}
                </Text>
              </Flex>
            );
          })}
        </Flex>
      </Box>

      {/* 4. Enhanced bookshelf with brown shelves and left-aligned rows */}
      <Box>
        <Flex w="100%" mb={4} align="center" justify="center">
          <Heading size="xl">Az Könyvespolcunk</Heading>
        </Flex>
        <Box
          width="100%"
          px={2}
          py={-3}
          backgroundPositionY={`${rowHeight + shelfGap}px`}
          bgImage={`
            repeating-linear-gradient(
              to bottom,
              transparent 0px,
              transparent ${rowHeight + shelfGap}px,
              #8B5E3C ${rowHeight + shelfGap}px,
              #8B5E3C ${rowHeight + shelfGap + shelfThickness}px
            )
          `}
          backgroundSize={`100% ${cycleHeight}px`}
        >
          <Flex wrap="wrap" justify="flex-start" align="flex-end">
            {orderedBooks.map((book, idx) => (
              <Box key={book.id || idx} flex="0 0 auto" m={1}>
                <BookSpine
                  book={book}
                  maxPages={maxPages}
                  moodColor={userColors[book.id]}
                />
              </Box>
            ))}
          </Flex>
        </Box>
      </Box>
    </Box>
  );
};

export default Stats;
