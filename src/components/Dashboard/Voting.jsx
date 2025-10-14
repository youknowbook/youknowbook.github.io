import React, { useState, useEffect, useMemo } from 'react'
import {
  Box,
  VStack,
  HStack,
  SimpleGrid,
  Image,
  Heading,
  Text,
  Button,
  Spinner,
  Alert,
  IconButton,
  Portal,
  Select,
  createListCollection,
  Popover,
  Fieldset,
  Checkbox,
  CheckboxGroup,
  RadioGroup,
  Flex
} from '@chakra-ui/react'
import {
  FaCheck,
  FaChevronUp,
  FaChevronDown,
  FaTimes,
  FaFilter,
  FaGlobe,
  FaVenusMars,
  FaSort,
  FaSortAmountUp,
  FaSortAmountDown
} from 'react-icons/fa'
import { supabase } from '../../api/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import BookDetailModal from '../../components/Books/BookDetailModal'

export default function Voting({ onClose, onVoted }) {
  const { user } = useAuth()
  const displayName = user.user_metadata?.display_name || ''

  const TIE_SENTINEL = 'all tie'

  // Data state
  const [loading, setLoading]     = useState(true)
  const [poll, setPoll]           = useState(null)
  const [options, setOptions]     = useState([])
  const [myVote, setMyVote]       = useState(null)
  const [round, setRound]         = useState(1)
  const [error, setError]         = useState(null)
  const [notification, setNotification] = useState(null)
  const [modalBook, setModalBook] = useState(null)

  // Filters + sorting state
  const [genreFilter,   setGenreFilter]   = useState([])
  const [countryFilter, setCountryFilter] = useState([])
  const [genderFilter,  setGenderFilter]  = useState([])
  const [sortField,     setSortField]     = useState('title')
  const [sortAsc,       setSortAsc]       = useState(true)

  const [allGenres,    setAllGenres]    = useState([])
  const [allCountries, setAllCountries] = useState([])
  const [allGenders,   setAllGenders]   = useState([])
  const [bannedBookIds, setBannedBookIds] = useState(new Set())


  const clearAll = () => {
    setGenreFilter([])
    setCountryFilter([])
    setGenderFilter([])
  }

  // Returns true if every voted book in the given tally received the same count
  function isAllTieFromTally(tally) {
    if (!tally) return false
    const counts = Object.values(tally).reduce((acc, bookId) => {
      acc[bookId] = (acc[bookId] || 0) + 1
      return acc
    }, {})
    const vals = Object.values(counts)
    return vals.length > 1 && vals.every(c => c === vals[0])
  }

  // Fetch the latest open poll for a given meeting ID
  async function fetchLatestOpenPoll(pastMeetingId) {
    const { data, error } = await supabase
      .from('polls')
      .select('id, round, tally, past_meeting_id, winner, status, created_at')
      .eq('status', 'open')
      .eq('past_meeting_id', pastMeetingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) return null
    return data || null
  }
  // 1) Load open poll (now grabbing `tally`)
  useEffect(() => {
    async function fetchPoll() {
      setLoading(true)
      const { data: p, error: pe } = await supabase
        .from('polls')
        .select('id, round, tally, past_meeting_id, winner, status, created_at')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (pe && pe.code !== 'PGRST116') {
        setError('Hiba töltéskor: ' + pe.message)
      } else if (!p) {
        setError('Nincs éppen nyitott szavazás.')
      } else {
        setPoll(p)
        setRound(p.round)
      }
      setLoading(false)
    }
    fetchPoll()
  }, [])

  // 2) Load options + existing vote (no more poll_options table)
  useEffect(() => {
    if (!poll) return;

    async function loadOptions() {
      setLoading(true);
      setError(null);

      try {
        // helper: full waitlist; optionally exclude current user's own books
        const fetchFullWaitlist = async (excludeOwn) => {
          let q = supabase
            .from('books')
            .select(`
              id, title, cover_url, author, page_count,
              genre, country, author_gender, release_year, user_id, is_selected
            `)
            .eq('is_selected', false);

          if (excludeOwn) q = q.neq('user_id', user.id);

          const { data, error } = await q;
          if (error) throw error;
          return data || [];
        };

        // helpers for round types
        const isTieRound   = r => r?.winner === TIE_SENTINEL;
        const isLegacyNext = r => r?.winner === 'next round'; // legacy safety
        const isNextRound  = r =>
          isLegacyNext(r) || (!r?.winner && !isAllTieFromTally(r?.tally)); // computed fallback

        let bs = [];
        let banned = new Set();

        if (round === 1) {
          // Round 1: exclude own; no bans yet
          bs = await fetchFullWaitlist(true);
        } else {
          // All completed rounds before this one (newest first)
          const { data: prevRows, error: prevErr } = await supabase
            .from('polls')
            .select('id, round, winner, tally, created_at')
            .eq('past_meeting_id', poll.past_meeting_id)
            .lt('round', round)
            .eq('status', 'complete')
            .order('created_at', { ascending: false });

          if (prevErr) throw prevErr;

          const rows = prevRows || [];
          const prevLast = rows[0] || null;
          const anyNextEver = rows.some(isNextRound); // first NEXT lifts "exclude own" forever
          const excludeOwnNow = !anyNextEver;         // only exclude own until the first NEXT

          if (!rows.length) {
            // No closed rounds yet → behave like round 1
            bs = await fetchFullWaitlist(true);
          } else if (isTieRound(prevLast)) {
            // ---- PREV = ALL TIE ----
            // Show the "original selection" again (full waitlist).
            // Exclude own only if we've never had a NEXT in this series.
            bs = await fetchFullWaitlist(excludeOwnNow);

            // Build consecutive tie chain (newest backwards) for banning user's previous picks
            const tieChain = [];
            for (const r of rows) {
              if (isTieRound(r)) tieChain.push(r);
              else break;
            }

            if (tieChain.length) {
              const tiePollIds = tieChain.map(r => r.id);
              const { data: myPrevVotes } = await supabase
                .from('votes')
                .select('poll_id, book_id, created_at')
                .in('poll_id', tiePollIds)
                .eq('user_id', user.id);

              const latestPerPoll = {};
              for (const v of (myPrevVotes || [])) {
                const cur = latestPerPoll[v.poll_id];
                if (!cur || new Date(v.created_at) > new Date(cur.created_at)) {
                  latestPerPoll[v.poll_id] = v;
                }
              }
              for (const v of Object.values(latestPerPoll)) {
                if (v?.book_id) banned.add(v.book_id);
              }
            }
          } else if (isNextRound(prevLast)) {
            // ---- PREV = NEXT ----
            // Finalists from cumulative counts of [the NEXT + any immediately preceding ALL TIEs]
            const segment = [prevLast];
            for (let i = 1; i < rows.length; i++) {
              if (isTieRound(rows[i])) segment.push(rows[i]);
              else break;
            }

            // cumulate counts across the segment
            const counts = {};
            for (const r of segment) {
              const t = r.tally || {};
              Object.values(t).forEach(bookId => {
                counts[bookId] = (counts[bookId] || 0) + 1;
              });
            }

            // finalists: all top ties; if exactly one leader, include all 2nd-place ties
            let filterIds = [];
            const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a);
            if (sorted.length) {
              const top = sorted[0][1];
              filterIds = sorted.filter(([, c]) => c === top).map(([id]) => id);
              if (filterIds.length === 1) {
                // only include second group if it actually has > 0 cumulative votes
                const second = sorted.find(([, c]) => c < top)?.[1] ?? 0;
                if (second > 0) {
                  filterIds = [
                    filterIds[0],
                    ...sorted.filter(([, c]) => c === second).map(([id]) => id),
                  ];
                }
              }
            }

            // STRONG rule: do NOT broaden the set here (no "hadAnyVotes" fallback).
            // If we somehow have no IDs (e.g., missing tallies), fall back to full waitlist (own allowed after NEXT).
            if (!filterIds.length) {
              bs = await fetchFullWaitlist(false);
            } else {
              const { data, error } = await supabase
                .from('books')
                .select('id, title, cover_url, author, page_count, genre, country, author_gender, release_year, user_id')
                .in('id', filterIds);
              if (error) throw error;
              // After NEXT, allow own books
              bs = data || [];
            }

            // After NEXT, no bans and no own-exclusion.
            banned = new Set();
          } else {
            // Safety default: treat as pre-NEXT phase
            bs = await fetchFullWaitlist(true);
          }
        }

        // Build option objects
        const opts = bs.map(b => ({
          book_id: b.id,
          book: { ...b, genres: b.genre },
        }));

        setOptions(opts);
        setBannedBookIds(banned);
        setAllGenres(Array.from(new Set(opts.flatMap(o => o.book.genres))).sort());
        setAllCountries(Array.from(new Set(opts.map(o => o.book.country).filter(Boolean))).sort());
        setAllGenders(Array.from(new Set(opts.map(o => o.book.author_gender).filter(Boolean))).sort());

        // Load this user's current-round vote
        const { data: v, error: ve } = await supabase
          .from('votes')
          .select('book_id')
          .eq('poll_id', poll.id)
          .eq('user_id', user.id)
          .eq('round', round)
          .maybeSingle();
        if (!ve && v) setMyVote(v.book_id);
      } catch (err) {
        console.error(err);
        setError(err.message || 'Hiba a könyvek betöltésekor');
      } finally {
        setLoading(false);
      }
    }

    loadOptions();
  }, [poll, round, user.id]);


  // Build headless collections
  const genreCollection   = useMemo(() =>
    createListCollection({ items: allGenres.map(g => ({ label: g, value: g })) }),
    [allGenres]
  )
  const countryCollection = useMemo(() =>
    createListCollection({ items: allCountries.map(c => ({ label: c, value: c })) }),
    [allCountries]
  )
  const genderCollection  = useMemo(() =>
    createListCollection({ items: allGenders.map(g => ({ label: g, value: g })) }),
    [allGenders]
  )
  const sortCollection    = useMemo(() =>
    createListCollection({
      items: [
        { label: 'ABC', value: 'title' },
        { label: 'Megjelenés', value: 'release_year' },
        { label: 'Oldalszám', value: 'page_count' },
      ],
    }),
    []
  )

  // Filter & sort logic
  const displayedOptions = useMemo(() => {
    let list = [...options]
    if (genreFilter.length)
      list = list.filter(o => o.book.genres.some(g => genreFilter.includes(g)))
    if (countryFilter.length)
      list = list.filter(o => countryFilter.includes(o.book.country))
    if (genderFilter.length)
      list = list.filter(o => genderFilter.includes(o.book.author_gender))

    list.sort((a, b) => {
      let va = a.book[sortField]
      let vb = b.book[sortField]
      if (sortField === 'title') {
        va = va.toLowerCase()
        vb = vb.toLowerCase()
      }
      if (va < vb) return sortAsc ? -1 : 1
      if (va > vb) return sortAsc ? 1 : -1
      return 0
    })
    return list
  }, [options, genreFilter, countryFilter, genderFilter, sortField, sortAsc])

  // Cast vote
  const castVote = async (bookId) => {
    if (!poll) return
    if (bannedBookIds.has(bookId)) {
      setNotification({ status: 'error', title: 'Ezt már kiválasztottad korábban ebben a szavazásban.' })
      return
    }

    // Always re-check the latest open poll for this meeting
    const latest = await fetchLatestOpenPoll(poll.past_meeting_id)
    if (!latest) {
      setNotification({ status: 'error', title: 'Nincs nyitott kör.' })
      return
    }
    // keep local state in sync if we were stale
    if (!poll || poll.id !== latest.id) {
      setPoll(latest)
      setRound(latest.round)
    }

    setLoading(true)
    const { error: ve } = await supabase
      .from('votes')
      .insert([{
        poll_id: latest.id,
        user_id: user.id,
        book_id: bookId,
        round: latest.round
      }])
    setLoading(false)

    if (ve) {
      setNotification({ status: 'error', title: 'Hiba', description: ve.message })
    } else {
      setMyVote(bookId)
      setNotification({ status: 'success', title: 'Szavazat sikeres!' })
      onVoted?.(latest.id, latest.round, bookId)
    }
  }

  // Undo vote
  const handleUnvote = async () => {
    if (!poll) return
    setLoading(true)
    const { error } = await supabase
      .from('votes')
      .delete()
      .eq('poll_id', poll.id)
      .eq('round', round)
      .eq('user_id', user.id)
    setLoading(false)
    if (error) {
      setNotification({ status: 'error', title: 'Hiba', description: error.message })
    } else {
      setMyVote(null)
      setNotification({ status: 'success', title: 'Szavazat visszavonva' })
    }
  }

  // Auto-dismiss notifications
  useEffect(() => {
    if (!notification) return
    const t = setTimeout(() => setNotification(null), 3000)
    return () => clearTimeout(t)
  }, [notification])

  // Round stop — only writes tally; Admin.finalizeRound decides winner/next/all-tie
  useEffect(() => {
    if (!myVote || !poll) return;

    (async () => {
      try {
        // 1) Always re-check the latest OPEN poll for this meeting
        const latest = await fetchLatestOpenPoll(poll.past_meeting_id);
        if (!latest || latest.id !== poll.id) return; // stale client; don't touch an old row

        // 2) Collect all votes for this poll & round
        const { data: votes, error: vErr } = await supabase
          .from('votes')
          .select('user_id, book_id')
          .eq('poll_id', latest.id)
          .eq('round', latest.round);
        if (vErr) throw vErr;

        // 3) Confirm all eligible attendees have voted
        const { data: theMeet, error: mErr } = await supabase
          .from('meetings')
          .select('attendees')
          .eq('id', latest.past_meeting_id)
          .single();
        if (mErr) throw mErr;

        const eligible = Array.isArray(theMeet?.attendees) ? theMeet.attendees : [];
        const uniqueVoters = [...new Set(votes.map(v => v.user_id))];
        if (uniqueVoters.length !== eligible.length) return; // wait for others

        // 4) Save THIS round's per-user tally (only if still open)
        const tally = votes.reduce((acc, { user_id, book_id }) => {
          acc[user_id] = book_id;
          return acc;
        }, {});

        const { error: upErr } = await supabase
          .from('polls')
          .update({ tally })
          .eq('id', latest.id)
          .eq('status', 'open'); // don't overwrite a closed row
        if (upErr) throw upErr;

        setNotification({
          status: 'info',
          title: 'Mindenki szavazott – várd meg az eredményhirdetést az Admin oldalon.',
        });
        // Do NOT compute or write `winner` here — Admin.finalizeRound handles it.
      } catch (e) {
        setNotification({
          status: 'error',
          title: 'Nem sikerült menteni a kör eredményét.',
          description: e?.message || String(e),
        });
      }
    })();
  }, [myVote, poll, round]);

  useEffect(() => {
    const channel = supabase
      .channel('polls-open-watch')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'polls',
        filter: `past_meeting_id=eq.${poll?.past_meeting_id || ''}`
      }, async payload => {
        // whenever a poll changes for this meeting, pull the latest open one
        const latest = await fetchLatestOpenPoll(payload.new?.past_meeting_id || poll?.past_meeting_id)
        if (latest && (!poll || poll.id !== latest.id)) {
          setPoll(latest)
          setRound(latest.round)
          setMyVote(null)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [poll?.past_meeting_id])

  if (loading) return <VStack py={10}><Spinner size="lg"/></VStack>
  if (error) {
    return (
      <Alert.Root status="error">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Hiba</Alert.Title>
          <Alert.Description>{error}</Alert.Description>
        </Alert.Content>
      </Alert.Root>
    )
  }


  return (
    <VStack spacing={6} align="stretch" p={4}>
      {notification && (
        <Alert.Root status={notification.status}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{notification.title}</Alert.Title>
            {notification.description && (
              <Alert.Description>{notification.description}</Alert.Description>
            )}
          </Alert.Content>
        </Alert.Root>
      )}

      {/* Header */}
      <HStack justify="space-between">
        <Heading size="md">Szavazás – {round}. forduló</Heading>
        <IconButton
            aria-label="Bezár"
            variant="ghost"
            colorScheme="gray"
            onClick={onClose}
        >
            {<FaTimes />}
        </IconButton>
      </HStack>

      <Flex w="100%" mb={2} align="center" justify="center">
        {myVote ? (
          <HStack spacing={3}>
            <Text fontSize="md" color="red.600" fontStyle="italic">
              Ebben a körben már szavaztál.
            </Text>

            <Popover.Root>
              <Popover.Trigger asChild>
                <Button
                  size="xs"
                  colorScheme="red"
                  onClick={e => e.stopPropagation()}
                >
                  Szavazat visszavonása
                </Button>
              </Popover.Trigger>
              <Portal>
                <Popover.Positioner>
                  <Popover.Content bg="red.50" p={4} borderRadius="md" w="260px">
                    <Popover.Body>
                      <Popover.Title fontSize="md" fontWeight="bold" color="red.800">
                        Visszavonás megerősítése
                      </Popover.Title>
                      <Text fontSize="sm" color="red.700" my={2}>
                        Biztosan visszavonod a szavazatod?
                      </Text>
                      <HStack justify="flex-end" spacing={2}>
                        <Popover.CloseTrigger asChild>
                          <Button size="xs">Vissza</Button>
                        </Popover.CloseTrigger>
                        <Button
                          size="xs"
                          colorScheme="red"
                          onClick={async e => {
                            e.stopPropagation()
                            await handleUnvote()
                          }}
                        >
                          Visszavonás
                        </Button>
                      </HStack>
                    </Popover.Body>
                  </Popover.Content>
                </Popover.Positioner>
              </Portal>
            </Popover.Root>
          </HStack>
        ) : (
          <Text fontSize="sm">
            Válassz egy könyvet a listából, majd kattints a „Szavazok” gombra.
          </Text>
        )}
      </Flex>

      {/* Desktop filters */}
      <Box display={{ base: 'none', md: 'flex' }} justifyContent="space-between"  alignItems="center">
        <HStack spacing={3}>
          {/* Genre */}
          <Select.Root multiple collection={genreCollection} value={genreFilter} onValueChange={e => setGenreFilter(e.value)}>
            <Select.HiddenSelect aria-label="Műfaj" />
            <Select.Label>Műfaj</Select.Label>
            <Select.Control>
              <Select.Trigger><Select.ValueText placeholder="Műfaj" /></Select.Trigger>
            </Select.Control>
            <Portal>
                <Select.Positioner>
                    <Select.Content asChild>
                    <Box
                        maxH="200px"
                        overflowY="auto"
                        minW="250px"
                        p={2}
                        bg="white"
                        shadow="md"
                        borderRadius="md"
                    >
                        {genreCollection.items.map(item => (
                        <Select.Item key={item.value} item={item}>
                            {item.label}
                            <Select.ItemIndicator><FaCheck/></Select.ItemIndicator>
                        </Select.Item>
                        ))}
                    </Box>
                    </Select.Content>
                </Select.Positioner>
                </Portal>
            </Select.Root>

          {/* Country */}
          <Select.Root multiple collection={countryCollection} value={countryFilter} onValueChange={e => setCountryFilter(e.value)}>
            <Select.HiddenSelect aria-label="Ország" />
            <Select.Label>Ország</Select.Label>
            <Select.Control>
              <Select.Trigger><Select.ValueText placeholder="Ország" /></Select.Trigger>
            </Select.Control>
            <Portal>
              <Select.Positioner>
                <Select.Content asChild>
                    <Box
                        maxH="200px"
                        overflowY="auto"
                        minW="250px"
                        p={2}
                        bg="white"
                        shadow="md"
                        borderRadius="md"
                    >
                    {countryCollection.items.map(item => (
                        <Select.Item key={item.value} item={item}>
                        {item.label}
                        <Select.ItemIndicator><FaCheck/></Select.ItemIndicator>
                        </Select.Item>
                    ))}
                    </Box>
                </Select.Content>
              </Select.Positioner>
            </Portal>
          </Select.Root>

          {/* Gender */}
          <Select.Root multiple collection={genderCollection} value={genderFilter} onValueChange={e => setGenderFilter(e.value)}>
            <Select.HiddenSelect aria-label="Szerző neme" />
            <Select.Label whiteSpace="nowrap">Szerző neme</Select.Label>
            <Select.Control>
              <Select.Trigger><Select.ValueText placeholder="Szerző neme" /></Select.Trigger>
            </Select.Control>
            <Portal>
              <Select.Positioner>
                <Select.Content asChild>
                    <Box
                        maxH="200px"
                        overflowY="auto"
                        minW="250px"
                        p={2}
                        bg="white"
                        shadow="md"
                        borderRadius="md"
                    >
                        {genderCollection.items.map(item => (
                            <Select.Item key={item.value} item={item}>
                            {item.label}
                            <Select.ItemIndicator><FaCheck/></Select.ItemIndicator>
                            </Select.Item>
                        ))}
                    </Box>
                </Select.Content>
              </Select.Positioner>
            </Portal>
          </Select.Root>

          <IconButton
            aria-label="Szűrők törlése"
            onClick={clearAll}
            flexShrink={0}
            mt={6}
            disabled={
              genreFilter.length === 0 &&
              countryFilter.length === 0 &&
              genderFilter.length === 0
            }
            >
                <Box position="relative" w="1.5em" h="1.5em">
                    <Box as={FaFilter} boxSize="1.5em" position="absolute" right="0.01em" />
                    <Box
                        as={FaTimes}
                        position="absolute"
                        top="2"
                        right="-1"
                        fontSize="0.6em"
                        color="red.500"
                    />
                </Box>
            </IconButton>
        </HStack>

        <HStack spacing={2}>
            <IconButton
                aria-label={sortAsc ? 'Növekvő' : 'Csökkenő'}
                onClick={() => setSortAsc(v => !v)}
                flexShrink={0}
                mt={6}
            >
                {sortAsc ? <FaSortAmountUp /> : <FaSortAmountDown />}
            </IconButton>
          <Select.Root 
            collection={sortCollection} 
            value={[sortField]} 
            onValueChange={e => {
              const [first = 'title'] = e.value 
              setSortField(first)
            }}>
            <Select.HiddenSelect aria-label="Rendezés"/>
            <Select.Label textAlign={"right"}>Rendezés</Select.Label>
            <Select.Control>
              <Select.Trigger><Select.ValueText placeholder="Rendezés" /></Select.Trigger>
            </Select.Control>
            <Portal>
              <Select.Positioner>
                <Select.Content asChild>
                    <Box
                        maxH="150px"
                        overflowY="auto"
                        minW="150px"
                        p={2}
                        bg="white"
                        shadow="md"
                        borderRadius="md"
                        position="absolute"
                        right="0"
                    >
                        {sortCollection.items.map(item => (
                            <Select.Item key={item.value} item={item}>
                            {item.label}
                            <Select.ItemIndicator><FaCheck/></Select.ItemIndicator>
                            </Select.Item>
                        ))}
                    </Box>
                </Select.Content>
              </Select.Positioner>
            </Portal>
          </Select.Root>
        </HStack>
      </Box>

      {/* Mobile icons */}
      <Box display={{ base: 'flex', md: 'none' }}>
        <HStack w="100%" alignItems="center">
          {/* Genre */}
          <Popover.Root>
            <Popover.Trigger asChild>
                <IconButton
                    aria-label="Műfaj"
                    variant={genreFilter.length ? 'solid' : 'outline'}
                >
                    <FaFilter/>
                </IconButton>
                </Popover.Trigger>
            <Popover.Positioner>
              <Popover.Content
                maxH="300px"
                overflowY="auto"
                w="80vw"
                p={3}
                bg="white"
                shadow="md"
                borderRadius="md"
            >
                <Popover.CloseTrigger asChild>
                    <IconButton aria-label="Bezár" size="sm">
                        <FaTimes/>
                    </IconButton>
                    </Popover.CloseTrigger>
                <Popover.Arrow><Popover.ArrowTip/></Popover.Arrow>
                <Popover.Body>
                    <Fieldset.Root>
                        <CheckboxGroup
                        value={genreFilter}
                        onValueChange={setGenreFilter}
                        name="genre"
                        >
                        <Fieldset.Legend fontSize="sm" mb="2">
                            Műfaj
                        </Fieldset.Legend>
                        <Fieldset.Content>
                            {allGenres.map(g => (
                            <Checkbox.Root key={g} value={g}>
                                <Checkbox.HiddenInput />
                                <Checkbox.Control />
                                <Checkbox.Label>{g}</Checkbox.Label>
                            </Checkbox.Root>
                            ))}
                        </Fieldset.Content>
                        </CheckboxGroup>
                    </Fieldset.Root>
                    </Popover.Body>
              </Popover.Content>
            </Popover.Positioner>
          </Popover.Root>

          {/* Country */}
          <Popover.Root>
            <Popover.Trigger asChild>
                <IconButton aria-label="Ország" variant={countryFilter.length ? 'solid' : 'outline'}>
                    <FaGlobe/>
                </IconButton>
                </Popover.Trigger>
            <Popover.Positioner>
              <Popover.Content
                maxH="300px"
                overflowY="auto"
                w="80vw"
                p={3}
                bg="white"
                shadow="md"
                borderRadius="md"
            >
                <Popover.CloseTrigger asChild>
                    <IconButton aria-label="Bezár" size="sm">
                        <FaTimes/>
                    </IconButton>
                    </Popover.CloseTrigger>
                <Popover.Arrow><Popover.ArrowTip/></Popover.Arrow>
                <Popover.Body>
                    <Fieldset.Root>
                        <CheckboxGroup
                        value={countryFilter}
                        onValueChange={setCountryFilter}
                        name="country"
                        >
                        <Fieldset.Legend fontSize="sm" mb="2">
                            Ország
                        </Fieldset.Legend>
                        <Fieldset.Content>
                            {allCountries.map(c => (
                            <Checkbox.Root key={c} value={c}>
                                <Checkbox.HiddenInput />
                                <Checkbox.Control />
                                <Checkbox.Label>{c}</Checkbox.Label>
                            </Checkbox.Root>
                            ))}
                        </Fieldset.Content>
                        </CheckboxGroup>
                    </Fieldset.Root>
                    </Popover.Body>
              </Popover.Content>
            </Popover.Positioner>
          </Popover.Root>

          {/* Gender */}
          <Popover.Root>
            <Popover.Trigger asChild>
                <IconButton aria-label="Szerző neme" variant={genderFilter.length ? 'solid' : 'outline'}>
                    <FaVenusMars/>
                </IconButton>
                </Popover.Trigger>
            <Popover.Positioner>
              <Popover.Content
                maxH="300px"
                overflowY="auto"
                w="80vw"
                p={3}
                bg="white"
                shadow="md"
                borderRadius="md"
            >
                <Popover.CloseTrigger asChild>
                    <IconButton aria-label="Bezár" size="sm">
                        <FaTimes/>
                    </IconButton>
                    </Popover.CloseTrigger>
                <Popover.Arrow><Popover.ArrowTip/></Popover.Arrow>
                <Popover.Body>
                    <Fieldset.Root>
                        <CheckboxGroup
                        value={genderFilter}
                        onValueChange={setGenderFilter}
                        name="gender"
                        >
                        <Fieldset.Legend fontSize="sm" mb="2">
                            Szerző neme
                        </Fieldset.Legend>
                        <Fieldset.Content>
                            {allGenders.map(g => (
                            <Checkbox.Root key={g} value={g}>
                                <Checkbox.HiddenInput />
                                <Checkbox.Control />
                                <Checkbox.Label>{g}</Checkbox.Label>
                            </Checkbox.Root>
                            ))}
                        </Fieldset.Content>
                        </CheckboxGroup>
                    </Fieldset.Root>
                    </Popover.Body>
              </Popover.Content>
            </Popover.Positioner>
          </Popover.Root>

          {/* Clear All */}
          <IconButton aria-label="Szűrők törlése" onClick={clearAll} disabled={
            genreFilter.length === 0 &&
            countryFilter.length === 0 &&
            genderFilter.length === 0
          }>
                <Box position="relative" w="1.5em" h="1.5em">
                    <Box as={FaFilter} boxSize="1.5em" position="absolute" right="0.01em" />
                    <Box
                        as={FaTimes}
                        position="absolute"
                        top="2"
                        right="-1"
                        fontSize="0.6em"
                        color="red.500"
                    />
                </Box>
            </IconButton>
        </HStack>

        <HStack spacing={2}>
          {/* Asc/Desc */}
          <IconButton
            aria-label={sortAsc ? 'Növekvő' : 'Csökkenő'}
            onClick={() => setSortAsc(v => !v)}
          >
                {sortAsc ? <FaSortAmountUp /> : <FaSortAmountDown />}
          </IconButton>
          {/* Sort */}
          <Popover.Root>
            <Popover.Trigger asChild>
                <IconButton aria-label="Rendezés">
                    <FaSort/>
                </IconButton>
             </Popover.Trigger>
            <Popover.Positioner>
              <Popover.Content>
                <Popover.CloseTrigger asChild>
                <IconButton aria-label="Bezár" size="sm">
                    <FaTimes/>
                </IconButton>
                </Popover.CloseTrigger>
                <Popover.Arrow><Popover.ArrowTip/></Popover.Arrow>
                <Popover.Body>
                  <Popover.Title mb={2} fontWeight={"bold"}>Rendezés</Popover.Title>
                  <RadioGroup.Root
                    value={sortField}
                    onValueChange={details  => setSortField(details.value)}
                    >
                    <HStack gap="4">
                        {sortCollection.items.map(item => (
                        <RadioGroup.Item key={item.value} value={item.value}>
                            <RadioGroup.ItemHiddenInput />
                            <RadioGroup.ItemIndicator />
                            <RadioGroup.ItemText>{item.label}</RadioGroup.ItemText>
                        </RadioGroup.Item>
                        ))}
                    </HStack>
                    </RadioGroup.Root>
                </Popover.Body>
              </Popover.Content>
            </Popover.Positioner>
          </Popover.Root>
        </HStack>
      </Box>

      {/* Book grid */}
      <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
        {displayedOptions.map(({ book_id, book }) => (
          <HStack key={book_id} p={3} borderWidth="1px" borderRadius="md" align="center" spacing={3}>
            <Image
              src={book.cover_url}
              alt={book.title}
              boxSize="50px"
              objectFit="cover"
              borderRadius="md"
              cursor="pointer"
              onClick={() => setModalBook(book)}
            />
            <Box flex="1" cursor="pointer" onClick={() => setModalBook(book)}>
              <Heading size="sm" noOfLines={1}>{book.title}</Heading>
              <Text fontSize="xs" color="gray.600" noOfLines={1}>
                {book.author} • {book.page_count} oldal
              </Text>
            </Box>
            <Popover.Root>
              <Popover.Trigger asChild>
                <Button
                  size="sm"
                  px={3}
                  minW="40px"
                  colorScheme={myVote === book_id ? 'green' : 'blue'}
                  disabled={!!myVote || bannedBookIds.has(book_id)}
                  onClick={e => e.stopPropagation()}
                  aria-label={
                    bannedBookIds.has(book_id)
                      ? 'Már kiválasztva'
                      : (myVote === book_id ? 'Szavaztál' : 'Szavazok')
                  }
                >
                  {bannedBookIds.has(book_id)
                    ? 'Már kiválasztva'
                    : (myVote === book_id ? <FaCheck/> : 'Szavazok')}
                </Button>
              </Popover.Trigger>
              <Portal>
                <Popover.Positioner>
                  <Popover.Content bg="blue.50" p={4} borderRadius="md" w="300px">
                    <Popover.Body>
                      <Popover.Title fontSize="md" fontWeight="bold" color="blue.800">
                        Szavazás megerősítése
                      </Popover.Title>
                      <Text fontSize="sm" color="blue.700" my={2}>
                        Biztos, hogy leadod a szavazatod a <b>{book.title}</b> című könyvre?
                      </Text>
                      <HStack justify="flex-end" spacing={2}>
                        <Popover.CloseTrigger asChild>
                          <Button size="xs">Vissza</Button>
                        </Popover.CloseTrigger>
                        <Button
                          size="xs"
                          colorScheme="blue"
                          onClick={async e => {
                            e.stopPropagation()
                            await castVote(book_id)
                          }}
                        >
                          Leadom
                        </Button>
                      </HStack>
                    </Popover.Body>
                  </Popover.Content>
                </Popover.Positioner>
              </Portal>
            </Popover.Root>
          </HStack>
        ))}
      </SimpleGrid>

      {modalBook && (
        <BookDetailModal
          book={modalBook}
          isOpen
          onClose={() => setModalBook(null)}
          showRecommendations
        />
      )}
    </VStack>
  )
}
