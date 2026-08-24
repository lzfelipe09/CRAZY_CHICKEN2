document.addEventListener("DOMContentLoaded", () => {

    const filters = document.querySelectorAll(".filter");
    const products = document.querySelectorAll(".product");
    const categoryLinks = document.querySelectorAll(".category-link");


    /*
    =====================================================
    FILTRO DO CATÁLOGO
    =====================================================
    */

    function filterProducts(category) {

        products.forEach(product => {

            const productCategory =
                product.dataset.category;

            const isNew =
                product.dataset.new === "true";


            if (category === "todos") {

                product.style.display = "";

            }

            else if (category === "novidades") {

                product.style.display =
                    isNew ? "" : "none";

            }

            else if (productCategory === category) {

                product.style.display = "";

            }

            else {

                product.style.display = "none";

            }

        });

    }


    /*
    =====================================================
    BOTÕES DO CATÁLOGO
    =====================================================
    */

    filters.forEach(filter => {

        filter.addEventListener("click", () => {

            filters.forEach(button => {
                button.classList.remove("active");
            });


            filter.classList.add("active");


            const category =
                filter.dataset.filter;


            filterProducts(category);

        });

    });



    /*
    =====================================================
    CATEGORIAS DA HOME
    =====================================================
    */

    categoryLinks.forEach(link => {

        link.addEventListener("click", () => {

            const category =
                link.dataset.categoryLink;


            filters.forEach(button => {

                button.classList.remove("active");


                if (
                    button.dataset.filter === category
                ) {

                    button.classList.add("active");

                }

            });


            filterProducts(category);

        });

    });



    /*
    =====================================================
    MENU MOBILE
    =====================================================
    */

    const mobileButton =
        document.querySelector(".menu-mobile");

    const menu =
        document.querySelector(".menu");


    if (mobileButton && menu) {

        mobileButton.addEventListener("click", () => {

            menu.classList.toggle("mobile-open");

        });


        menu.querySelectorAll("a").forEach(link => {

            link.addEventListener("click", () => {

                menu.classList.remove("mobile-open");

            });

        });

    }

});