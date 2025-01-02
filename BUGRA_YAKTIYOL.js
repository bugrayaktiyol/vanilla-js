(() => {
  let state = null;
  let elements = null;
  let eventHandlers = null;
  let navigationController = null;
  
  const self = {
    init: async () => {
      self.buildCSS();
      await self.buildHTML();
      self.setEvents();
    },

    buildHTML: async () => {
      const storage = await self.loadStorage();
      if (!storage) return;

      const productWidth = self.getProductWidth();
      const productsPerView = self.getProductsPerView(productWidth);

      // I've created a state module to manage the carousel state and the carousel elements
      state = self.createCarouselState(productsPerView, storage, productWidth);
      elements = self.createCarouselElements(storage);
      eventHandlers = self.createEventHandlers();
      navigationController = self.createNavigationController();

      elements.$mainContainer.append(
        elements.$title,
        elements.$chevronLeft,
        elements.$carouselContainer,
        elements.$chevronRight
      );

      $(".product-detail").append(elements.$mainContainer);
    },

    buildCSS: () => {
      const css = `
              ${self.addCarouselStyles()}
              ${self.addTitleStyles()}
              ${self.addCarouselContainerStyles()}
              ${self.addProductStyles()}
          `;

      $("<style>").addClass("carousel-style").html(css).appendTo("head");
    },

    setEvents: () => {
      if (!elements) return;

      // Desktop event listeners for chevrons
      elements.$chevronLeft.on("click", navigationController.handleLeftClick);
      elements.$chevronRight.on("click", navigationController.handleRightClick);

      // Mobile touch event listeners
      elements.$wrapper
        .on("touchstart", eventHandlers.handleDragStart)
        .on("touchmove", eventHandlers.handleDragMove)
        .on("touchend", eventHandlers.handleDragEnd);
      
        let resizeTimeout;
        $(window).on('resize', () => {
          // Debounce uygula
          clearTimeout(resizeTimeout);
          resizeTimeout = setTimeout(() => {
            self.handleResize();
          }, 250);
        });
    },

    // Data Module functions
    loadStorage: async () => {
      let storage = JSON.parse(localStorage.getItem("products"));
      if (!storage) {
        try {
          const data = await self.fetchProducts(CONFIG.productsEndpoint);
          if (data.length === 0) {
            throw new Error("No data found");
          }
          storage = data;
          localStorage.setItem("products", JSON.stringify(storage));
        } catch (err) {
          console.error(err);
          return null;
        }
      }
      return storage;
    },

    fetchProducts: async (url) => {
      try {
        const resp = await fetch(url);
        return await resp.json();
      } catch (err) {
        throw new Error(err);
      }
    },
    // I've created a validation module to ensure that the product data is complete and valid
    validateProductFields: (product) => {
      const requiredFields = ["id", "img", "name", "url"];
      for (const field of requiredFields) {
        if (!product[field]) {
          console.error(`Product is missing required field: ${field}`);
          return false;
        }
      }
      return true;
    },

    // Carousel state management
    createCarouselState: (productsPerView, storage, productWidth) => {
      const totalProducts = storage.length;
      const maxTranslate =
        -(totalProducts + 1 - productsPerView) * productWidth;

      const initialState = {
        startX: 0,
        isDragging: false,
        startTranslate: 0,
        currentTranslate: 0,
        animationId: null,
        currentIndex: 0,
        productWidth: productWidth,
        maxTranslate: maxTranslate,
      };

      return {
        getState: () => initialState,
        setState: (newState) => Object.assign(initialState, newState),
      };
    },

    // UI Building functions
    createCarouselElements: (storage) => {
      const $mainContainer = $("<div>").addClass("carousel");
      const $title = $("<h1>").text("You Might Also Like").addClass("title");
      const $carouselContainer = $("<div>").addClass("carousel-container");
      const $wrapper = $("<div>").addClass("carousel-wrapper");

      const $chevronLeft = $("<button>")
        .addClass("chevron chevron-left")
        .html(chevronSVG)
        .prop("disabled", true);

      const $chevronRight = $("<button>")
        .addClass("chevron chevron-right")
        .html(chevronSVG);

      // Build products
      storage.forEach((product) => {
        const $product = self.buildProduct(product);
        $wrapper.append($product);
      });

      $carouselContainer.append($wrapper);

      return {
        $mainContainer,
        $title,
        $carouselContainer,
        $wrapper,
        $chevronLeft,
        $chevronRight,
      };
    },

    buildProduct: (product) => {
      if (!self.validateProductFields(product)) {
        return;
      }

      const likedProducts =
        JSON.parse(localStorage.getItem("likedProducts")) || [];

      const $productContainer = $("<div>")
        .addClass("product-container")
        .attr("id", `product-${product.id}`);

      const $likeButtonContainer = $("<div>").addClass("like-button-container");
      const $likeButton = $("<button>")
        .addClass("new-product-card-like-button")
        .attr("id", `like-button-${product.id}`);

      if (likedProducts.includes(product.id.toString())) {
        $likeButton.addClass("new-product-card-like-button-fav");
      }

      $likeButton.on("click", self.handleLikeButtonClick);
      $likeButtonContainer.append($likeButton);

      const $productImage = $("<img>")
        .attr("src", product.img)
        .addClass("product-image")
        .on("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          window.open(product.url, "_blank");
        });

      const $productName = $("<a>")
        .text(product.name)
        .addClass("product-name")
        .attr("href", product.url)
        .attr("target", "_blank");

      const $productPrice = $("<p>")
        .text(`${product.price} ₺`)
        .addClass("product-price");

      $productContainer.append(
        $likeButtonContainer,
        $productImage,
        $productName,
        $productPrice
      );

      return $productContainer;
    },

    // Event handlers
    createEventHandlers: () => {
      const setSliderPosition = () => {
        elements.$wrapper.css(
          "transform",
          `translateX(${state.getState().currentTranslate}px)`
        );
      };

      const animate = () => {
        setSliderPosition();
        if (state.getState().isDragging) {
          state.setState({ animationId: requestAnimationFrame(animate) });
        }
      };

      const updateButtons = () => {
        const { currentTranslate, maxTranslate } = state.getState();
        elements.$chevronLeft.prop("disabled", currentTranslate >= 0);
        elements.$chevronRight.prop(
          "disabled",
          currentTranslate <= maxTranslate
        );
      };

      return {
        handleDragStart: (event) => {
          const { currentTranslate, animationId } = state.getState();
          const startX = event.touches[0].clientX;

          state.setState({
            startX,
            isDragging: true,
            startTranslate: currentTranslate,
          });

          if (animationId) cancelAnimationFrame(animationId);
          animate();
        },

        handleDragMove: (event) => {
          const { isDragging, startX, startTranslate, maxTranslate } =
            state.getState();
          if (!isDragging) return;

          const currentPosition = event.touches[0].clientX;
          const diff = currentPosition - startX;
          let newTranslate = startTranslate + diff;

          if (newTranslate > 100) newTranslate = 100;
          else if (newTranslate < maxTranslate - 100)
            newTranslate = maxTranslate - 100;

          state.setState({ currentTranslate: newTranslate });
        },

        handleDragEnd: () => {
          const { currentTranslate, maxTranslate, productWidth } =
            state.getState();

          state.setState({ isDragging: false });

          let finalTranslate = currentTranslate;
          if (currentTranslate > 0) finalTranslate = 0;
          else if (currentTranslate < maxTranslate)
            finalTranslate = maxTranslate;

          const snapPosition =
            Math.round(finalTranslate / productWidth) * productWidth;
          const newIndex = Math.abs(Math.round(snapPosition / productWidth));

          elements.$wrapper.css("transition", "transform 0.3s ease-out");
          state.setState({
            currentTranslate: snapPosition,
            currentIndex: newIndex,
          });

          setSliderPosition();
          setTimeout(() => elements.$wrapper.css("transition", "none"), 300);
          updateButtons();
        },

        updateButtons,
      };
    },

    createNavigationController: () => {
      return {
        handleLeftClick: () => {
          const { currentIndex, productWidth } = state.getState();
          const newIndex = Math.max(0, currentIndex - 1);
          const newTranslate = -(newIndex * productWidth);
          elements.$wrapper.css("transition", "transform 0.3s ease-out");
          state.setState({
            currentIndex: newIndex,
            currentTranslate: newTranslate,
          });

          elements.$wrapper.css("transform", `translateX(${newTranslate}px)`);

          eventHandlers.updateButtons();
        },

        handleRightClick: () => {
          const { currentIndex, productWidth, maxTranslate } = state.getState();
          const newIndex = Math.min(
            Math.abs(maxTranslate / productWidth),
            currentIndex + 1
          );
          const newTranslate = -(newIndex * productWidth);
          elements.$wrapper.css("transition", "transform 0.3s ease-out");
          state.setState({
            currentIndex: newIndex,
            currentTranslate: newTranslate,
          });

          elements.$wrapper.css("transform", `translateX(${newTranslate}px)`);

          eventHandlers.updateButtons();
        },
      };
    },

    // I've created a resize module to handle the carousel resizing when the window is resized
    handleResize: () => {
      if (!state || !elements) return;

      const productWidth = self.getProductWidth();
      const productsPerView = self.getProductsPerView();

      const currentState = state.getState();
      const storage = JSON.parse(localStorage.getItem("products")) || [];
      const totalProducts = storage.length;
      const maxTranslate = -(totalProducts + 1 - productsPerView) * productWidth;

      state.setState({
        ...currentState,
        productWidth,
        maxTranslate,
      });

      elements.$wrapper.find('.product-container').each(function() {
        $(this).css('width', `calc(${productWidth}px + 20px)`);
      });

      const newTranslate = -(currentState.currentIndex * productWidth);
      state.setState({ currentTranslate: newTranslate });
      elements.$wrapper.css('transform', `translateX(${newTranslate}px)`);

      if (eventHandlers) {
        eventHandlers.updateButtons();
      }
    },

    handleLikeButtonClick: (event) => {
      event.preventDefault();

      const productID = event.target.id.split("-").pop();
      const $likeButton = $(`#like-button-${productID}`);
      const isLiked = $likeButton.hasClass("new-product-card-like-button-fav");

      let likedProducts =
        JSON.parse(localStorage.getItem("likedProducts")) || [];

      if (isLiked) {
        $likeButton.removeClass("new-product-card-like-button-fav");
        likedProducts = likedProducts.filter((id) => id !== productID);
      } else {
        $likeButton.addClass("new-product-card-like-button-fav");
        if (!likedProducts.includes(productID)) {
          likedProducts.push(productID);
        }
      }
      localStorage.setItem("likedProducts", JSON.stringify(likedProducts));
    },

    // Utility functions
    // The reason I'm using 0.8 multiple times because main container width is 80% of the window width as well as the carousel container width is 80% of the main container width
    getProductWidth: () => {
      const width = window.innerWidth;
      if (width <= 768) {
        // Mobile
        return width * 0.8 * 0.8 - 20;
      } else if (width <= 1024) {
        // Tablet
        return (width * 0.8 * 0.8) / 2 - 20;
      }
      return (width * 0.8 * 0.8) / 7 - 20; // Desktop: 6.5 products view
    },

    getProductsPerView: () => {
      const width = window.innerWidth;
      if (width <= 768) {
        return 1; // Mobile
      } else if (width <= 1024) {
        return 2; // Tablet
      }
      return 6.5; // Desktop
    },

    // Styles
    addCarouselStyles: () => `
          .carousel {
              width: 80%;
              display: block;
              justify-content: center;
              align-items: center;
              flex-direction: column;
              margin: 0 auto;
              padding: 20px;
              text-align: center;
              background-color: #f9f9f9;
              border-radius: 8px;
              position: relative;
          }

          .carousel-container {
              width: 80%;
              margin: 0 auto;
              overflow: hidden;
              position: relative;
              touch-action: pan-y pinch-zoom;
          }

          .carousel-wrapper {
              display: flex;
              margin: 0 auto;
              gap: 16px;
              user-select: none;
              -webkit-user-select: none;
              touch-action: pan-x;
              will-change: transform;
          }

          .chevron {
              position: absolute;
              top: 50%;
              transform: translateY(-75%);
              z-index: 2;
              background: transparent;
              border: none;
              width: 48px;
              height: 48px;
              display: flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              transition: opacity 0.3s ease;
          }

          .chevron:disabled {
              opacity: 0.5;
              cursor: not-allowed;
          }

          .chevron-left {
              left: 7.5%;
          }

          .chevron-right {
              right: 7.5%;
          }

          .chevron-right svg {
              transform: rotate(180deg);
          }

          .product-container {
              width: calc(${self.getProductWidth()}px + 20px);
              flex: 0 0 auto;
              aspect-ratio: 0.75;
              display: flex;
              flex-direction: column;
              padding-bottom: 12px;
              transition: width 0.3s ease;
          }

          @media (max-width: 768px) {
              .carousel {
                  width: 100%;
                  padding: 10px;
              }
              
              .carousel-container {
                  width: 100%;
              }

              .chevron {
                  display: none;
              }
          }

          @media (min-width: 769px) and (max-width: 1024px) {
              .carousel-container {
                width: 100%;
              }
        
              .chevron {
                  display: none;
              }
          }
      `,

    addTitleStyles: () => `
          .carousel .title {
              color: #29323b;
              text-align: left;
              font-size: 32px;
              font-weight: 300;
              margin-bottom: 15px;
          }
      `,

    addCarouselContainerStyles: () => `
          .carousel-container {
              display: flex;
              gap: 20px;
              padding: 10px;
          }
      `,

    addProductStyles: () => `
          .product-container {
              text-align: center;
              background-color: #fff;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
              position: relative;
          }

          .product-image {
              width: 100%;
              height: 'auto';
              object-fit: cover;
              margin-bottom: 10px;
              cursor: pointer;
          }

          .product-name {
              color: #29323b;
              font-size: 16px;
              margin: 4px 10px;
            }
              .product-name:hover {
                text-decoration: none;
            }

            .product-price {
                color: #193db0;
                font-size: 18px;
                text-align: left;
                font-weight: bold;
                line-height: 22px;
                margin: 0 10px;
            }
            
            .like-button-container {
                position: absolute;
                top: 12px;
                right: 12px;
                z-index: 1;
            }
                
            .new-product-card-like-button {
                width: 36px;
                height: 36px;
                border: solid .5px #b6b7b9;
                border-radius: 5px;
                box-shadow: 0 3px 6px 0 rgba(0, 0, 0, .16);
                background-image: url("data:image/svg+xml,${encodeURIComponent(
                  heartEmpty
                )}");
                background-repeat: no-repeat;
                background-position: center;
                background-color: white;
                cursor: pointer;
                transition: transform 0.2s ease;
            }
            
            .new-product-card-like-button-fav {
                background-image: url("data:image/svg+xml,${encodeURIComponent(
                  heartFull
                )}");
            }
            
            .new-product-card-like-button:hover {
                transform: scale(1.1);
            }
        `,
  };

    //Assets
    const chevronSVG = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14.242" height="24.242" viewBox="0 0 14.242 24.242">
            <path fill="none" stroke="#333" stroke-linecap="round" stroke-width="3px" 
                d="M2106.842 2395.467l-10 10 10 10" transform="translate(-2094.721 -2393.346)">
            </path>
        </svg>
    `;

    const heartEmpty = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20.576" height="19.483" viewBox="0 0 20.576 19.483">
            <path fill="none" stroke="#555" stroke-width="1.5px" d="M19.032 7.111c-.278-3.063-2.446-5.285-5.159-5.285a5.128 5.128 0 0 0-4.394 2.532 4.942 4.942 0 0 0-4.288-2.532C2.478 1.826.31 4.048.032 7.111a5.449 5.449 0 0 0 .162 2.008 8.614 8.614 0 0 0 2.639 4.4l6.642 6.031 6.755-6.027a8.615 8.615 0 0 0 2.639-4.4 5.461 5.461 0 0 0 .163-2.012z" transform="translate(.756 -1.076)"></path>
        </svg>
    `;

    const heartFull = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="#183DB0"/>
        </svg>
    `;

    // Configuration
    const CONFIG = {
        productsEndpoint:
            "https://gist.githubusercontent.com/sevindi/5765c5812bbc8238a38b3cf52f233651/raw/56261d81af8561bf0a7cf692fe572f9e1e91f372/products.json",
    };

    $(self.init);
})();