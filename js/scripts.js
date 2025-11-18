function checkIsMobile() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const isLandscape = width > height;

  // mobile fino a 1024px o landscape con altezza ridotta
  return width <= 768 || (isLandscape && height <= 640);
}

const { createApp } = Vue;

const vueApp = createApp({
    data() {
        return {
            officialLinks: [],
            channels: [],
            loading: true,
            error: null,
            currentSection: 'homepage',
            currentTime: '',
            currentDate: '',
            favorites: {
                channels: [], // array di stringhe
                programs: []  // array di oggetti "program"
            },
            selectedChannel: null,
            selectedProgram: null,
            showBottomSheet: false,
            bottomSheetContent: null,
            showScheduleModal: false,
            showProgramDetailModal: false,
            searchQuery: '',
            showCookieBanner: false,
            cookiesAccepted: false,
			hideAiredMovies: true,
            epgOnlyFavorites: false,
            epgOnlyOnAir: false,
            epgOnlyEvening: false,
            EPG_EVENING_START: 20,
            EPG_EVENING_END: 24,
            EPG_PIXELS_PER_MINUTE: 4,
			isMobile: false,
            startY: 0,
            currentY: 0,
            isDragging: false,
            newGreetingsName:'',
            greetingsName:'straniero',
            greetingsTime: 'Salve',
            tagList:[],
            autoScrollTimer: null,
            scrolled: false,
        }
    },

    computed: {
        hasFavorites() {
            return this.favorites.channels.length > 0 || this.favorites.programs.length > 0;
        },

        favoriteChannels() {
            return this.channels.filter(channel =>
                this.favorites.channels.includes(channel.name)
            );
        },

        favoritePrograms() {
            const now = new Date();
            const today = now.toDateString();

            return this.favorites.programs.map(p => {
                let isOnAir = false;
                let isScheduled = false;

                // scansiona tutti i canali
                for (const channel of this.channels) {
                    // trova se c'è un programma con lo stesso cleanTitle
                    const prog = channel.programs.find(pr => pr.cleanTitle === p.cleanTitle);

                    if (prog) {
                        // programma trovato nella lista corrente
                        // aggiorna isScheduled se il programma è programmato oggi
                        const progDate = prog.start.toDateString();
                        if (progDate === today) {
                            isScheduled = true;
                        }

                        // aggiorna isOnAir se il programma è in onda ora
                        if (prog.isOnAir) {
                            isOnAir = true;
                        }
                    }

                    // se entrambi già veri, possiamo uscire dal ciclo
                    if (isOnAir && isScheduled) break;
                }

                return {
                    ...p,
                    isOnAir,
                    isScheduled,
                    isFavorite: true,
                };
            });
        },

        /*channelsWithCurrentProgram() {
            return this.channels.filter(channel => this.getCurrentProgram(channel) !== null);
        },

        channelsWithEveningPrograms() {
            return this.channels.filter(channel => this.getEveningPrograms(channel).length > 0);
        },*/

        searchResults() {
            if (this.searchQuery.length < 2) return [];

            const results = [];
            const searchLower = this.searchQuery.toLowerCase();
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            this.channels.forEach(channel => {
                if (channel.name.toLowerCase().includes(searchLower)) {
                    results.push({
                        type: 'channel',
                        channel: channel,
                        program: null,
                        key: `channel-${channel.id}`,
                        image: channel.logo,
                        title: channel.name,
						category: ''
                    });
                }

                channel.programs.forEach(program => {
                    if (program.title.toLowerCase().includes(searchLower)
					   || program.category?.toLowerCase().includes(searchLower)) {
                        const start = this.utcToLocal(program.start);
                        if (start.toDateString() === today.toDateString()) {
                            results.push({
                                type: 'program',
                                channel: channel,
                                program: program,
                                key: `program-${channel.id}-${program.start}`,
                                image: program.image ?? channel.logo,
                                title: program.title,
								category: program.category ?? ''
                            });
                        }
                    }
                });
            });

            return results;
        },

        allMoviesChannels(){
            let channels = [];

            return channels;
        },

        allMovies() {
            let movies = [];
            this.channels.forEach(channel => {
                channel.programs.forEach(program => {
                    //aggiungi se ora di inizio superiore ad ora
                    const now = new Date();
					const endOfDay = new Date();
					endOfDay.setHours(this.EPG_EVENING_END,0,0,0);// end of day

                    if(program.category?.toLowerCase() === 'film') {

                        // nascondo i film già finiti
                        if (this.hideAiredMovies && program.stop < now) {
                            return;
                        }

						if (program.start > endOfDay) { //nascondo quelli che iniziano dopo mezzanotte
							return;
						}

                        // altrimenti includi
                        program.showFullDescription = !this.isMobile;
                        program.tmdbLink = this.getTmdbLink(program.cleanTitle);
                        movies.push(program);
                        
                    }
                });
            });
            return movies;
        },

        timeSlotsAllDay() {
            const slots = [];
            const startH = new Date().getHours()-1;
            for (let hour = startH; hour <= this.EPG_EVENING_END; hour++) {
                slots.push(`${hour}:00`);
                slots.push(`${hour}:30`);
            }
            return slots;
        },

        timeSlotsEvening() {
            const slots = [];
            for (let hour = this.EPG_EVENING_START; hour <= this.EPG_EVENING_END; hour++) {
                slots.push(`${hour}:00`);
                slots.push(`${hour}:30`);
            }
            return slots;
        },

        epgChannels() {
            if (this.epgOnlyFavorites == true) {
                return this.favoriteChannels;
            }
            return this.channels;
        },

        // recupero solo i programmi attualmente in onda
        carouselOnAirPrograms(){
            const now = new Date();
            const onAir = [];
            this.channels.forEach(channel => {
                channel.programs.forEach(program => {
                    if(program.isOnAir){
                        onAir.push(program);
                    }
                });
            });
            return onAir;
        }

    }, // computed
    watch: {
        hideAiredMovies: 'saveFilters',
        epgOnlyFavorites: 'saveFilters',
        epgOnlyEvening(newVal) {
            if(newVal == true){
                this.epgOnlyOnAir = false;
            }
            this.saveFilters();
        },
        epgOnlyOnAir(newVal) {
            if(newVal == true){
                this.epgOnlyEvening = false;
            }
            this.saveFilters();
        }
    },
    methods: {
        async loadData() {
            this.loading = true;
            this.error = null;

            const now = new Date();
            var jsonData;
            var item = localStorage.getItem("epgData");
            var data = {};
            var loadFromInternet = false;
            
            if(!item){
                //non è presente localstorage
                loadFromInternet = true;
            }
            else{
                data = JSON.parse(item);
                
                const saved = new Date(data.date);
                //localstorage non è aggiornato
                if (saved.toDateString() !== now.toDateString()) {
                    loadFromInternet = true;
                }
                else{
                    // dati già pronti.
                    this.channels = data.channels;
                    this.officialLinks = data.officialLinks;
                }
            }
            
            if(loadFromInternet){
                const originalUrl = 'https://www.emax83dev.it/api/epg';
                var response;

                try {
                    // fetch local file
                    response = await fetch('/data/channels.json');
                    if (!response.ok) throw new Error('Direct fetch failed');
                    
                    this.officialLinks = await response.json();

                } catch (err) {
                    console.error('Errore nel caricamento officialLinks:', err);
                    this.officialLinks = [];
                }
                
                try {

                    response = await fetch(originalUrl);
                    if (!response.ok) throw new Error('Direct fetch failed');

                } catch (directError) {

                    const corsProxies = [
                        `https://api.allorigins.win/raw?url=${encodeURIComponent(originalUrl)}`,
                        `https://corsproxy.io/?${encodeURIComponent(originalUrl)}`,
                        `https://cors-anywhere.herokuapp.com/${originalUrl}`,
                        '/api/epg', //local serverless function
                        '/data/list.json' //local static file
                    ];
                    
                    for (const proxyUrl of corsProxies) {
                        try {
                            response = await fetch(proxyUrl);
                            if (response.ok) break;
                        } catch (e) {
                            console.log('Proxy failed:', e);
                        }
                    }
                }

                if (!response || !response.ok) {
                    throw new Error('Impossibile caricare i dati');
                }

                jsonData = await response.json();
                var programId = 0;
                var channelId = 0;
                // creo la lista arrichita.
                this.channels = jsonData.map(item => {
                    channelId++;
                    return {
                        id: channelId,
                        name: item.name,
                        epgName: item.epgName,
                        logo: item.logo || '/img/placeholder.png',
                        externalUrl:
                            this.officialLinks.find(link => link.epgName === item.name)?.externalUrl ||
                            "https://www.google.com/search?q=live+streaming+" + encodeURIComponent(item.name),
                        isFavorite: false,
                        programs: item.programs.map(program => {
                            const startLocal = this.utcToLocal(program.start);
                            const endLocal = this.utcToLocal(program.end);
                            programId++;
                            return {
                                id: channelId + '-' + programId,
                                start: startLocal,
                                stop: endLocal,
                                end: endLocal, // retrocompatibilità
                                startTime: this.formatTime(program.start),
                                stopTime: this.formatTime(program.end),
                                endTime: this.formatTime(program.end), //retrocompatibilità
                                durationMin: Math.round((endLocal - startLocal) / 60000),
                                pixels: this.EPG_PIXELS_PER_MINUTE * ((endLocal - startLocal) / 60000),
                                isEvening: startLocal.getHours() >= this.EPG_EVENING_START,
                                isSameDay: startLocal.toDateString() === now.toDateString(),
                                isOnAir: (endLocal > now && now >= startLocal), // si aggiornarà nella funzione updateIsOnAir
                                isFavorite: false, // verrà impostato.
                                isScheduled: true, // essendo nella guida è true
                                title: program.title,
                                cleanTitle: this.cleanTitle(program.title),
                                tmdbLink: '',
                                description: program.description || '',
                                shortDescription: (program.description?.substring(0, 50) + "..." || ''),
                                category: program.category || '',
                                image: program.poster || '/img/placeholder.png',
                                channelName: item.name,
                                channelLogo: item.logo || '/img/placeholder.png',
                            };
                        })
                    };
                });
            }
            
            

            // creo la lista tag
            this.tagList = [];
            this.channels.forEach(channel => { 
                channel.programs.forEach(program => {
                    //ritrasformo in date in quanto se recupero da localStorage, le date sono diventate stringhe.
                    program.start = new Date(program.start);
                    program.stop = new Date(program.stop);
                    program.end = new Date(program.stop);
                    const cat = program.category?.trim();
                    if (cat && !this.tagList.includes(cat)) {
                        this.tagList.push(cat);
                    }
                });
            });
            
            data = {
                date: now.toISOString(),
                channels: this.channels,
                officialLinks: this.officialLinks
            };
            localStorage.setItem("epgData", JSON.stringify(data));

            this.loading = false;
            
        },
        
        isNullOrWhiteSpace(input){
            // controlla null o undefined
            if (input === null || input === undefined) return true;

            // controlla tipo stringa e se, tolti gli spazi, è vuota
            return typeof input === 'string' && input.trim().length === 0;
        },

        cleanTitle(title) {
              return title.replace(/\s*\(.*?\).*$/, "").trim();
        },

        saveFilters(){
            try{
                const filters = {
                    hideAiredMovies: this.hideAiredMovies,
                    epgOnlyFavorites: this.epgOnlyFavorites,
                    epgOnlyOnAir: this.epgOnlyOnAir,
                    epgOnlyEvening: this.epgOnlyEvening,
                    greetingsName: this.greetingsName,
                };

                localStorage.setItem('guidatv_settings', JSON.stringify(filters));
            }
            catch(err){
                console.error('saveFilters; Error: ', err);
            }
        },

        loadFilters(){
            try{
                var settings = {
                    hideAiredMovies: true,
                    epgOnlyFavorites: false,
                    epgOnlyOnAir: false,
                    epgOnlyEvening: false,
                    greetingsName: 'straniero'
                };
                const stored = localStorage.getItem('guidatv_settings');
                if (stored) {
                    settings = JSON.parse(stored);
                }

                this.hideAiredMovies = settings.hideAiredMovies;
                this.epgOnlyFavorites = settings.epgOnlyFavorites;
                this.epgOnlyOnAir = settings.epgOnlyFavorites;
                this.epgOnlyEvening = settings.epgOnlyFavorites;
                this.greetingsName = settings.greetingsName || 'straniero';
            }
            catch(err){
                console.error('loadFilters; Error: ', err);
            }
        },

        loadGreetings(){
            const now = new Date();
            if(now.getHours() < 12){
                this.greetingsTime = 'Buongiorno';
            }
            else if(now.getHours() < 18){
                this.greetingsTime = 'Buon pomeriggio';
            }
            else if (now.getHours() < 24){
                this.greetingsTime = 'Buonasera';
            }
        },

        utcToLocal(utcDateStr) {
            const date = new Date(utcDateStr);
            return new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Rome' }));
        },

        formatTime(date) {
            date = new Date(date);
            return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        },

        updateCurrentTime() {
            const now = new Date();
            this.currentTime = this.formatTime(now);
            const giorni = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
            const mesi = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

            const giornoSettimana = giorni[now.getDay()];
            const giorno = now.getDate().toString().padStart(2, '0');
            const mese = mesi[now.getMonth()];
            const ore = now.getHours().toString().padStart(2, '0');
            const minuti = now.getMinutes().toString().padStart(2, '0');

            this.currentDate = `${giornoSettimana} ${giorno} ${mese} ${ore}:${minuti}`;
        },

        updateIsOnAir(){
            const now = new Date();
            for (const channel of this.channels) {
                for (const p of channel.programs) {
                    p.isOnAir = (now >= p.start && now < p.stop);
                }
            }
        },

		updateEpgTimeline() {
			if (this.currentSection === 'epg' && this.isMobile == false) {
				const timeline = document.getElementById('currentTimeline');
                if(timeline){
                    var pixels = 1000000;
                    var minutes = 0;
                    var now = new Date();
                    var start = new Date();
                    start.setHours(0,0,0,0);
                    if (this.epgOnlyOnAir) {
                        start.setHours(now.getHours(),0,0,0);
                    }
                    if (this.epgOnlyEvening) {
                        start.setHours(this.EPG_EVENING_START,0,0,0);
                    }
                    minutes = Math.floor((now - start) / 60000);
                    pixels = (this.EPG_PIXELS_PER_MINUTE * minutes);
                    timeline.style.left = pixels + 'px';
                    if(this.scrolled == false){
                        timeline.scrollIntoView(); //non mi permette di visualizzare la guida!
                        this.scrolled=true;
                    }
                    
                }
			}
		},

        getTmdbLink(title){
            if(!title){
                return '#';
            }

            const url = 'https://www.themoviedb.org/search?query=' + encodeURIComponent(title);
            return url;
            
            /* da IMPLEMENTARE
            const apiKey = '<<TMDB_API_KEY>>'; // inserisci la tua chiave TMDB
            const url = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(title)}&language=it-IT`;

            try {
                const response = await fetch(url);
                const data = await response.json();

                if (data.results && data.results.length > 0) {
                    const movie = data.results[0];
                    // ritorna link diretto alla pagina del film su TMDB
                    return `https://www.themoviedb.org/movie/${movie.id}`;
                } else {
                    return null;
                }
            } catch (error) {
                console.error('Errore TMDB:', error);
                return null;
            }
            */
        },

        getCurrentProgram(channel) {
            const now = new Date();
            return channel.programs.find(program => {
                const start = this.utcToLocal(program.start);
                const end = this.utcToLocal(program.stop);
                return now >= start && now < end;
            });
        },

       
        getEpgProgramStyle(program) {
            const start = this.utcToLocal(program.start);
            const end = this.utcToLocal(program.stop);
            
            // Base time: 20:00
            const baseTime = new Date(start);
            baseTime.setHours(this.EPG_EVENING_START, 0, 0, 0);
            
            // Calculate minutes from 20:00
            const startMinutes = (start - baseTime) / 1000 / 60;
            const duration = (end - start) / 1000 / 60;
            
            // Each 30 min slot is 60px
            const pixelsPerMinute = 60 / 30;
            const top = startMinutes * pixelsPerMinute;
            const height = duration * pixelsPerMinute;
            
            return {
                top: `${top}px`,
                height: `${Math.max(height - 4, 30)}px` // Min height 30px, -4px for spacing
            };
        },

        getTodayPrograms(channel) {
            const today = new Date();
            const hh = today.getHours();
            today.setHours(hh, 0, 0, 0);
            const endDay = new Date();
            endDay.setHours(23,59,59,999);
            return channel.programs
                .filter(program => {
                    const start = this.utcToLocal(program.start); 
                    const stop = this.utcToLocal(program.stop); 
                    return (stop > today && start < endDay);
                })
                .sort((a, b) => this.utcToLocal(a.start) - this.utcToLocal(b.start));
        },

         getEveningPrograms(channel) {
            const today = new Date();
            const startEvening = new Date();
            startEvening.setHours(this.EPG_EVENING_START,0,0,0);
            const endEvening = new Date();
            endEvening.setHours(this.EPG_EVENING_END,30,0,0);
            return channel.programs
                .filter(program => {
                    const start = this.utcToLocal(program.start);
                    const stop = this.utcToLocal(program.stop);
                    return (stop > startEvening && start < endEvening);
                })
                .sort((a, b) => this.utcToLocal(a.start) - this.utcToLocal(b.start));
        },

        getEpgTimeSlots() {
            const slots = [];
            try {
                const now = new Date();
                let startHour = 0;

                if (this.epgOnlyEvening) {
                    startHour = this.EPG_EVENING_START;
                }

                if (this.epgOnlyOnAir) {
                    startHour = now.getHours();
                }

                // 0..23 (23:30 è l’ultimo slot valido)
                for (let hour = startHour; hour <= this.EPG_EVENING_END; hour++) {
                    slots.push(`${hour.toString().padStart(2, '0')}:00`);
                    slots.push(`${hour.toString().padStart(2, '0')}:30`);
                }

            } catch (err) {
                console.error('getEpgTimeSlots Error:', err);
            }

            return slots;
        },

        getEpgChannels(){
            try{
                /*
				if(this.epgOnlyFavorites){
                    return this.channels.filter(channel => 
                        this.favorites.channels.some(fav => fav.name === channel.name)
                    );
                }
                return this.channels;
				*/

				if (this.epgOnlyFavorites) {
				    return this.channels.filter(channel => {
				        const isFavChannel = this.favorites.channels
				            .some(fav => fav.name === channel.name);
				
				        const hasFavPrograms = channel.programs
				            ?.some(p => this.favorites.programs
				                ?.some(fp => fp.title === p.title));
				
				        return isFavChannel || hasFavPrograms;
				    });
				}
				
				return this.channels;
								
            }
            catch(err){
                console.error('getEpgChannels; Error: ', err);
                return [];
            }
        },

        getEpgPrograms(channel) {
            try {
                const now = new Date();

                const startEvening = new Date();
                startEvening.setHours(this.EPG_EVENING_START, 0, 0, 0);

                const endOfDay = new Date();
                endOfDay.setHours(this.EPG_EVENING_END, 0, 0, 0);

                const nextHour = new Date(now);
                nextHour.setHours(now.getHours() + 1, 0, 0, 0);

                return channel.programs.filter(program => {

                    // --- FILTRO: ONLY EVENING ---
                    if (this.epgOnlyEvening) {
                        const isEvening =
                            program.isSameDay &&
                            (
                                program.start >= startEvening ||      // inizia dopo le 20
                                program.stop  > startEvening          // o è iniziato prima ma ancora in corso dopo le 20
                            ) &&
                            program.start <= endOfDay;                // non supera la mezzanotte

                        if (!isEvening) return false;
                    }

                    // --- FILTRO: ONLY ON AIR ---
                    if (this.epgOnlyOnAir) {
                        const startsNextHour = program.start >= now && program.start < nextHour;
                        const inProgress = program.start <= now && program.stop >= now;
                        if (!inProgress && !startsNextHour) return false;
                    }

					/*
                    // --- FILTRO: ONLY FAVORITES ---
                    if (this.epgOnlyFavorites && this.favorites.programs.length > 0) {
                        const isFavorite = this.favorites.programs
                            .some(fav => fav.title === program.title);
                        if (!isFavorite) return false;
                    }
					*/

                    return true;
                });

            } catch (err) {
                console.error('getEpgPrograms Error:', err);
                return [];
            }
        },

        calculateProgress(program) {
            const now = new Date();
            const start = this.utcToLocal(program.start);
            const end = this.utcToLocal(program.stop);
            const total = end - start;
            const elapsed = now - start;
            return Math.min(100, Math.max(0, (elapsed / total) * 100));
        },

        /*getDuration(program) {
            const start = this.utcToLocal(program.start);
            const end = this.utcToLocal(program.stop);
            const minutes = Math.round((end - start) / 60000);
            return `${minutes} min`;
        },*/

        getProgress(program){
            if(!program) return 0;
            if (!program?.start || !program?.stop) return 0;

            const now = new Date();
            const start = new Date(program.start);
            const stop = new Date(program.stop);

            if (now <= start) return 0;
            if (now >= stop) return 100;

            const total = stop - start;
            const elapsed = now - start;
            return (elapsed / total) * 100;
        },

        getProgramWidth(program){
            try {
                const today = new Date();
                const hh = today.getHours()-1;
                today.setHours(hh, 0, 0, 0);
                const endDay = new Date();
                endDay.setHours(this.EPG_EVENING_END, 0, 0, 0);
                //hh è l'ora di inizio dell'epg.

                // timeslot = 30 minuti = 120px = 1minuto = 4px
                const start = this.utcToLocal(program.start);
                const stop = this.utcToLocal(program.stop);

                // differenza in millisecondi
                var diffMs = stop - start; //durata del programma.

                if(start < today & stop > today){
                    //devo togliere i minuti già trascorsi
                    diffMs = stop - today;
                }
                if (start < endDay & stop > endDay) {
                    //devo togliere i minuti oltre le 24
                    diffMs = endDay - start;
                }

                // conversione in minuti
                var diffMinutes = Math.floor(diffMs / 60000); 
                
                return (diffMinutes * 4) + 'px';

            }
            catch(err){
                console.log("getProgramWidth; Error: " + err.message);
                return '120px';
            }
        },

        getProgramHeight(program){
            try {
                // 30 minuti = 120px
                // qui si parte dalle 20:00 fino alle 24:00
                
                const today = new Date();
                today.setHours(this.EPG_EVENING_START, 0, 0, 0);
                const endDay = new Date();
                endDay.setHours(this.EPG_EVENING_END,30,0,0);
                //hh è l'ora di inizio dell'epg.

                // timeslot = 30 minuti = 120px = 1minuto = 4px
                const start = this.utcToLocal(program.start);
                const stop = this.utcToLocal(program.stop);

                // differenza in millisecondi
                var diffMs = stop - start;

                // se un programma inizia dopo le 20 ma prima delle 24
                // caso normale, non faccio nulla

                // se un programma è iniziato prima delle 20 ma termina dopo le 20
                if (start < today & stop > today) {
                    // differenza di minuti restanti
                    diffMs = stop - today;
                }

                // se un programma inizia prima delle 24 ma termina dopo le 24
                if (start < endDay & stop > endDay) {
                    // differenza di minuti visibili
                    diffMs = endDay - start;
                }

                // differenza da millisecondi in minuti
                var diffMinutes = Math.floor(diffMs / 60000);

                // devo l'altezza in pixels: 1 minuto = 4 pixel.
                var pixels = diffMinutes * 4;

                return pixels + 'px';                

            }
            catch(err){
                console.log("getProgramHeight; Error: " + err.message);
                return '120px';
            }
        },

        /*isFavoriteProgramScheduled(favorite){
            // Trova il canale
            const channel = this.channels.find(ch => ch.name === favorite.channelName);
            if (!channel || !channel.programs) return false;

            // Trova il programma con lo stesso titolo
            const program = channel.programs.find(p => p.title === favorite.title);
            if (program) {
                return true;
            }
            else{
                return false;
            }
        },

        isFavoriteProgramLive(favorite){
            // Trova il canale
            const channel = this.channels.find(ch => ch.name === favorite.channelName);
            if (!channel || !channel.programs) return false;

            // Trova il programma con lo stesso titolo
            const program = channel.programs.find(p => p.title === favorite.title);
            if (!program) return false;

            // Verifica se è attualmente in onda
            const now = new Date();
            const start = this.utcToLocal(program.start);
            const stop = this.utcToLocal(program.stop);

            return now >= start && now <= stop;
        },*/

        isProgramLive(program) {
            if (program){
                const now = new Date();
                const start = this.utcToLocal(program.start);
                const end = this.utcToLocal(program.stop);
                return now >= start && now < end;
            }
            return false;
        },

        loadFavorites() {
            try {
                var stored = localStorage.getItem('guidatv_favorites');
                if (stored) {
                    this.favorites = JSON.parse(stored);
                }
            } catch (e) {
                console.error('Error loading favorites:', e);
            }
        },

        saveFavorites() {
            try {
                localStorage.setItem('guidatv_favorites', JSON.stringify(this.favorites));
            } catch (e) {
                console.error('Error saving favorites:', e);
            }
        },

        isFavoriteChannel(channelName) {
            return this.favorites.channels.includes(channelName);
        },

        toggleFavoriteChannel(channelName) {
            const index = this.favorites.channels.indexOf(channelName);
            if (index > -1) {
                // rimuove il canale dai preferiti
                this.favorites.channels.splice(index, 1);
            } else {
                // aggiunge il canale ai preferiti
                this.favorites.channels.push(channelName);
            }

            this.saveFavorites();
        },

        isFavoriteProgram(programTitle) {
            return this.favorites.programs.some(p => p.cleanTitle === programTitle);
        },

        toggleFavoriteProgram(program) {
            const index = this.favorites.programs.findIndex(p => p.cleanTitle === program.cleanTitle);
            if (index > -1) {
                // rimuove il programma dai preferiti
                this.favorites.programs.splice(index, 1);
            } else {
                // aggiunge il programma ai preferiti
                this.favorites.programs.push(program);
            }

            this.saveFavorites();
        },

        showNowPlaying(channel) {
            const currentProgram = this.getCurrentProgram(channel);
            if (!currentProgram) return;

            this.selectedChannel = channel;
            this.selectedProgram = currentProgram;
            this.showBottomSheet = true;
        },

        showEveningPrograms(channel) {
            this.selectedChannel = channel;
            this.showBottomSheet = true;
        },

        showProgramInModal(channel, program) {
            this.selectedProgram = program;
            this.selectedChannel = channel || this.channels.find(c => c.name === program.channelName);
            this.showScheduleModal = false;
            this.showProgramDetailModal = true;
            this.showBottomSheet = true;
        },

        showChannelSchedule(channel) {
            this.selectedChannel = channel;
            this.selectedProgram = null;
            this.showScheduleModal = true;
            this.showProgramDetailModal = false;
            //scroll programs finchè non trova quello della ora corrente
            
            this.$nextTick(() => {
                // ottieni il container dello scroll
                const el = document.getElementById('scheduleContent');
                if (el) {
                    // ottieni tutti gli elementi dei programmi
                    const programs = el.querySelectorAll('.program-card');

                    // trova il programma attualmente on-air
                    const program = channel.programs.find(p => p.isOnAir);

                    if (program) {
                        // trova l'elemento corrispondente nella lista DOM
                        const programEl = Array.from(programs).find(
                            card => card.dataset.programId === program.id
                        );

                        // se esiste, scrolla fino ad esso
                        if (programEl) {
                            programEl.scrollIntoView({
                                behavior: 'smooth',
                                block: 'start'
                            });
                        }
                    }
                }
            });
        },

        openChannelDetail(channel) {
            const currentProgram = this.getCurrentProgram(channel);
            if (currentProgram) {
                this.showNowPlaying(channel);
            } else {
                this.showChannelSchedule(channel);
            }
        },

        handleSearchResultClick(result) {
             if(result.type == 'channel'){
                this.showChannelSchedule(result.channel);
            } else if (result.type == 'program'){
                this.showProgramInModal(result.channel, result.program);
            }
        },

        handleFavoriteChannelClick(channel){
            this.showChannelSchedule(channel);
        },

        handleFavoriteProgramClick(program) {
            const channel = JSON.parse(JSON.stringify(this.channels.find(c => c.name === program.channelName))); 
            if (program.isScheduled) {
                const sameTitlePrograms = channel.programs.filter(
                    item => item.cleanTitle === program.cleanTitle
                );
                channel.programs = sameTitlePrograms;
                this.showChannelSchedule(channel);
                //this.showChannelSchedule(program.channel);

            } else {
                this.showProgramInModal(channel, program);
                //alert(`"${program.title}" non è programmato oggi su ${program.channelName}`);
            }
        },

        loadCookieConsent() {
            try {
                const stored = localStorage.getItem('guidatv_cookie_consent');
                if (!stored) {
                    setTimeout(() => {
                       this.showCookieBanner = true;
                        this.cookiesAccepted = false;
                    }, 1000);
                }
                else{
                    const opt = JSON.parse(stored);
                    this.showCookieBanner = opt.bannerVisible;
                    this.cookiesAccepted = opt.cookiesAccepted;
                }

                if(this.cookiesAccepted == true){
                    //carico gli script di trackind
                    this.loadTrackingScripts();
                }
            } catch (e) {
                console.error('Error loading cookie consent:', e);
            }
        },

        acceptCookies(accepted) {
            try {
                this.showCookieBanner = false;
                this.cookiesAccepted = accepted;
                localStorage.setItem('guidatv_cookie_consent', JSON.stringify({
                    bannerVisible: false,
                    cookiesAccepted: accepted
                }));

                this.loadCookieConsent();

            } catch (e) {
                console.error('Error saving cookie consent:', e);
            }
        },
        loadTrackingScripts(){
            try{

            }
            catch(err){
                console.error('loadTrackingScripts; Error saving cookie consent:', e);
            }
        },

        /* handleImageError(event) {
            const fallback = "/img/placeholder.png";
            if (event.target.src.includes(fallback)) return;
            event.target.src = fallback;
            //event.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%231a1f3a' width='100' height='100'/%3E%3Ctext x='50%25' y='50%25' font-size='14' fill='%230dcaf0' text-anchor='middle' dy='.3em'%3ETV%3C/text%3E%3C/svg%3E";
        }, */
		updateDevice() {
      		this.isMobile = checkIsMobile();
  	    },
        startDrag(event) {
            this.isDragging = true;
            this.startY = event.touches[0].clientY;
        },
        onDrag(event) {
            if (!this.isDragging) return;
            this.currentY = event.touches[0].clientY;
            const diff = this.currentY - this.startY;
            if (diff > 0) {
            this.$refs.modal.style.transform = `translateY(${diff}px)`;
            this.$refs.modal.style.transition = "none";
            }
        },
        endDrag() {
            this.isDragging = false;
            const diff = this.currentY - this.startY;

            // Se trascinata abbastanza, chiudi
            if (diff > 100) {
                this.showBottomSheet=false;
            } else {
            // Ritorna alla posizione originale
            this.$refs.modal.style.transition = "transform 0.3s ease";
            this.$refs.modal.style.transform = "translateY(0)";
            }

            this.startY = 0;
            this.currentY = 0;
        },
         getCardWidth(){
       const first = this.$refs.carousel?.querySelector('.tv-carousel-item');
       return first ? first.clientWidth : 300;
     },
       scrollNext() {
            if(this.currentSection == 'homepage'){
                const el = this.$refs.carousel;
                if(!el) return;
                const w = this.getCardWidth();
                el.scrollBy({ left: w, behavior: 'smooth' });
            }
        },

        scrollPrev() {
            if(this.currentSection == 'homepage'){
                const el = this.$refs.carousel;
                if(!el) return;
                const w = this.getCardWidth();
                el.scrollBy({ left: -w, behavior: 'smooth' });
            }
        },

        startAutoScroll() {
          this.pauseAutoScroll();
            this.autoScrollTimer = setInterval(() => {
                this.scrollNext();
              this.checkLoop();
            }, 3000);
        },

        pauseAutoScroll() {
            clearInterval(this.autoScrollTimer);
        },

        resumeAutoScroll() {
            this.startAutoScroll();
        },
       checkLoop(){
          const el = this.$refs.carousel;
         if(!el) return;
         const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 5;
         if(atEnd){
           setTimeout(()=> el.scrollTo({left:0,behavior: 'smooth'}),300);
         }
       },
      setupTouch(){
        const el = this.$refs.carousel;
        if(!el) return;
        let startX = 0;
        el.addEventListener("touchstart", e => {
          startX = e.touches[0].clientXM
        });
        el.addEventListener("toucheend", e =>{
          const endX = e.changedTouches[0].clientX;
          const delta = endX - startX;
          if(Math.abs(delta) < 50) return;
          if(delta < 0) this.scrollNext();
          else this.scrollPrev();
        });
      }
    },
    mounted() {
		this.isMobile = checkIsMobile();

        window.addEventListener('resize', () => {
        this.isMobile = checkIsMobile();
        });
        window.addEventListener('orientationchange', () => {
        this.isMobile = checkIsMobile();
        });
        
        this.loadCookieConsent();
        this.loadFavorites();
        this.loadFilters();
        this.loadData();
        this.loadGreetings();
        this.startAutoScroll();
        this.setupTouch();
        this.updateCurrentTime();
        setInterval(() => {
            this.updateCurrentTime();
            this.updateIsOnAir();
            this.updateEpgTimeline();
        }, 60000);
    },
	beforeUnmount() {
        clearInterval(this.autoScrollTimer);
        window.removeEventListener('resize', this.updateDevice);
        window.removeEventListener('orientationchange', this.updateDevice);
  },
}).mount('#app');

