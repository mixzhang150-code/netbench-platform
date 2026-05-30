import { useState, useEffect } from 'react';
import { Box, Typography, Card, CardContent, Grid, Skeleton, useTheme, useMediaQuery } from '@mui/material';
import { sponsorShowcaseApi, SponsorShowcaseConfig, SponsorShowcaseItem } from '../api';

interface SponsorShowcaseProps {
  page: 'ping' | 'http' | 'dashboard' | 'sponsor';
  position?: 'top' | 'sidebar' | 'footer';
}

export function SponsorShowcase({ page, position = 'top' }: SponsorShowcaseProps) {
  const [config, setConfig] = useState<SponsorShowcaseConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const theme = useTheme();
  const isMobile = !useMediaQuery(theme.breakpoints.up('sm'));
  const isTablet = !useMediaQuery(theme.breakpoints.up('md'));

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setLoading(true);
        const res = await sponsorShowcaseApi.getPageConfig(page);
        if (res.data.success && res.data.data) {
          setConfig(res.data.data);
        }
      } catch {
        setConfig(null);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [page]);

  if (loading) {
    return (
      <Box sx={{ mb: 3 }}>
        <Skeleton variant="text" width={60} height={20} sx={{ mb: 1.5 }} />
        <Grid container spacing={1}>
          {[...Array(isMobile ? 6 : isTablet ? 12 : 24)].map((_, i) => (
            <Grid item xs={4} sm={3} md={2} lg={1.5} key={i}>
              <Skeleton variant="rectangular" height={isMobile ? 50 : 60} sx={{ borderRadius: 1 }} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if (!config || !config.enabled || config.sponsors.length === 0) {
    return null;
  }

  const filteredSponsors = config.sponsors
    .filter(s => s.enabled && s.position === position)
    .sort((a, b) => a.order - b.order)
    .slice(0, config.maxItems || 30);

  if (filteredSponsors.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mb: 3 }}>
      {config.title && (
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            color: '#999',
            mb: 1.5,
            fontSize: '0.75rem',
            fontWeight: 500,
            borderLeft: '3px solid #1976d2',
            pl: 1,
          }}
        >
          {config.title}
        </Typography>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? '90px' : isTablet ? '110px' : '130px'}, 1fr))`,
          gap: 1,
        }}
      >
        {filteredSponsors.map((sponsor) => (
          <SponsorLogoCard key={sponsor.id} sponsor={sponsor} />
        ))}
      </Box>
    </Box>
  );
}

function SponsorLogoCard({ sponsor }: { sponsor: SponsorShowcaseItem }) {
  const [imgError, setImgError] = useState(false);

  if (sponsor.url) {
    return (
      <Box
        component="a"
        href={sponsor.url}
        target="_blank"
        rel="noopener noreferrer"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          aspectRatio: '2.5 / 1',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          p: { xs: 0.75, sm: 1 },
          bgcolor: 'background.paper',
          transition: 'all 0.2s ease-in-out',
          textDecoration: 'none',
          overflow: 'hidden',
          '&:hover': {
            borderColor: 'primary.light',
            boxShadow: '0 2px 8px rgba(25,118,210,0.12)',
            transform: 'translateY(-1px)',
            bgcolor: 'action.hover',
          },
        }}
      >
        {sponsor.logo && !imgError ? (
          <Box
            component="img"
            src={sponsor.logo}
            alt={sponsor.name}
            sx={{
              width: '100%',
              height: '100%',
              maxWidth: 'calc(100% - 8px)',
              maxHeight: 'calc(100% - 8px)',
              objectFit: 'contain',
              objectPosition: 'center',
            }}
            onError={() => setImgError(true)}
          />
        ) : (
          <Typography
            sx={{
              fontSize: { xs: '0.65rem', sm: '0.7rem' },
              fontWeight: 600,
              color: 'text.secondary',
              textAlign: 'center',
              lineHeight: 1.2,
              px: 1,
            }}
          >
            {sponsor.name}
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        aspectRatio: '2.5 / 1',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        p: { xs: 0.75, sm: 1 },
        bgcolor: 'background.paper',
        overflow: 'hidden',
      }}
    >
      {sponsor.logo && !imgError ? (
        <Box
          component="img"
          src={sponsor.logo}
          alt={sponsor.name}
          sx={{
            width: '100%',
            height: '100%',
            maxWidth: 'calc(100% - 8px)',
            maxHeight: 'calc(100% - 8px)',
            objectFit: 'contain',
            objectPosition: 'center',
          }}
          onError={() => setImgError(true)}
        />
      ) : (
        <Typography
          sx={{
            fontSize: { xs: '0.65rem', sm: '0.7rem' },
            fontWeight: 600,
            color: 'text.secondary',
            textAlign: 'center',
            lineHeight: 1.2,
            px: 1,
          }}
        >
          {sponsor.name}
        </Typography>
      )}
    </Box>
  );
}
