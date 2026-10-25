import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Box, Flex, Heading, Image, Text } from '@chakra-ui/react'
import { CARD_WIDTH, groupTimelineBooks, timelineLayout, yearLabel } from './timelineLayout'

function BookCover({ book }) {
  return (
    <Box w="72px" title={`${book.title} – ${book.author}`}>
      {book.cover_url
        ? <Image src={book.cover_url} alt={book.title} w="72px" h="104px" objectFit="contain" />
        : <Flex w="72px" h="104px" bg="gray.100" align="center" justify="center" p={1}><Text fontSize="xs">Nincs borító</Text></Flex>}
      <Text fontSize="xs" lineHeight="16px" mt="4px" h="32px" lineClamp={2}>{book.title}</Text>
    </Box>
  )
}

export default function BookTimeline({ books }) {
  const viewport = useRef(null)
  const [availableWidth, setAvailableWidth] = useState(900)
  const markerId = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const { groups, unknown } = useMemo(() => groupTimelineBooks(books), [books])
  const layout = useMemo(() => timelineLayout(groups, availableWidth), [groups, availableWidth])
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setAvailableWidth(Math.floor(entry.contentRect.width)))
    observer.observe(viewport.current)
    return () => observer.disconnect()
  }, [])

  return (
    <Box mb={10} minW="0">
      <Heading size="xl" textAlign="center" mb={2}>Az Idővonalunk</Heading>
      <Text textAlign="center" fontSize="sm" color="gray.600" mb={2}>A könyvek megjelenési éve szerint · a nyilak a pontos évhez kapcsolódnak</Text>
      <Box ref={viewport} overflowX="auto" pb={3} tabIndex={groups.length ? 0 : undefined}
        role="region" aria-label="Könyvek megjelenési idővonala, vízszintesen görgethető">
        {groups.length ? (
          <Box position="relative" w={`${layout.width}px`} h={`${layout.height}px`} data-testid="book-timeline">
            <svg width={layout.width} height={layout.height} aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
              <defs>
                <marker id={`${markerId}-axis`} markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
                  <path d="M0 0 L10 5 L0 10 Z" fill="#475569" />
                </marker>
                <marker id={`${markerId}-book`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                  <path d="M0 0 L8 4 L0 8 Z" fill="#64748b" />
                </marker>
              </defs>
              <line x1="24" y1={layout.axisY} x2={layout.width - 24} y2={layout.axisY}
                stroke="#475569" strokeWidth="3" markerEnd={`url(#${markerId}-axis)`} />
              {layout.cards.map(card => (
                <g key={card.year}>
                  <path d={`M ${card.anchorX} ${layout.axisY} L ${card.centerX} ${card.edgeY}`}
                    fill="none" stroke="#64748b" strokeWidth="1.5" markerEnd={`url(#${markerId}-book)`} />
                  <circle cx={card.anchorX} cy={layout.axisY} r={Math.min(9, 4 + Math.sqrt(card.books.length))} fill="#2563eb" stroke="white" strokeWidth="1.5" />
                </g>
              ))}
              {layout.ticks.map(tick => (
                <g key={tick.year}>
                  <line x1={tick.x} x2={tick.x} y1={layout.axisY - 6} y2={layout.axisY + 6} stroke="#64748b" />
                  <text x={tick.x} y={layout.axisY + 27} textAnchor="middle" fontSize="12" fill="#475569" stroke="white" strokeWidth="4" paintOrder="stroke">{yearLabel(tick.year)}</text>
                </g>
              ))}
            </svg>
            {layout.cards.map(card => (
              <Box key={card.year} position="absolute" left={`${card.centerX - CARD_WIDTH / 2}px`}
                top={`${card.top}px`} w={`${CARD_WIDTH}px`} h={`${card.height}px`}
                p="12px" bg="white" border="1px solid" borderColor="gray.300" borderRadius="md" boxShadow="sm"
                role="group" aria-label={`${yearLabel(card.year)}: ${card.books.length} könyv`}>
                <Text fontWeight="bold" textAlign="center" h="24px" mb="8px">{yearLabel(card.year)} <Text as="span" fontWeight="normal" fontSize="xs">({card.books.length} könyv)</Text></Text>
                <Box display="grid" gridTemplateColumns={card.books.length === 1 ? '72px' : 'repeat(2, 72px)'} justifyContent="center" gap="12px">
                  {card.books.map(book => <BookCover key={book.id} book={book} />)}
                </Box>
              </Box>
            ))}
          </Box>
        ) : <Text textAlign="center" py={4}>Még nincs ismert megjelenési évű könyv.</Text>}
      </Box>
      {unknown.length > 0 && (
        <Box mt={4} p={4} border="1px solid" borderColor="gray.200" borderRadius="md">
          <Text fontWeight="bold" mb={3}>Ismeretlen megjelenési év</Text>
          <Flex gap={3} wrap="wrap">{unknown.map(book => <BookCover key={book.id} book={book} />)}</Flex>
        </Box>
      )}
    </Box>
  )
}
