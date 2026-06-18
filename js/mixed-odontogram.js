const teeth = document.querySelectorAll(".tooth")

teeth.forEach(tooth => {

    tooth.addEventListener("click", () => {

        tooth.classList.toggle("selected")

        console.log({
            tooth: tooth.dataset.tooth,
            type: tooth.classList.contains("primary") ? "baby" : "permanent"
        })

    })

})