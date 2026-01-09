import React, { useEffect, useState } from 'react';
import { Container, Box, Typography, Paper } from '@mui/material';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';

const TESTIMONIALS = [
  { name: 'Eric', quote: 'We shipped our API in a day — game changer.', role: 'Staff Engineer', avatar: 'https://i.pravatar.cc/100?img=12' },
  { name: 'Amir', quote: 'Docs and relations out of the box saved weeks.', role: 'Tech Lead', avatar: 'https://i.pravatar.cc/100?img=33' },
  { name: 'Mae', quote: 'ER diagrams are clean and shareable — love it.', role: 'Product Manager', avatar: 'https://i.pravatar.cc/100?img=22' },
];

const Testimonials = () => {
  const [slidesPerView, setSlidesPerView] = useState(3);
  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      setSlidesPerView(w < 600 ? 1 : w < 900 ? 2 : 3);
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <Box sx={{ py: 6, bgcolor: 'grey.100' }}>
      <Container maxWidth="lg">
        <Typography variant="h4" sx={{ mb: 3, fontWeight: 700 }}>Loved by teams</Typography>
        <Swiper modules={[Autoplay, Pagination]} autoplay={{ delay: 3500 }} pagination={{ clickable: true }} slidesPerView={slidesPerView} spaceBetween={16}>
          {TESTIMONIALS.map((t, idx) => (
            <SwiperSlide key={idx}>
              <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <img src={t.avatar} alt={t.name} style={{ width: 44, height: 44, borderRadius: 22 }} />
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{t.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{t.role}</Typography>
                  </Box>
                </Box>
                <Typography variant="body1">“{t.quote}”</Typography>
              </Paper>
            </SwiperSlide>
          ))}
        </Swiper>
      </Container>
    </Box>
  );
};

export default Testimonials;