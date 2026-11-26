import { useEffect, useCallback } from 'react'
import { useThree } from '@react-three/fiber'

export default function Screenshot() {
    const { gl, scene, camera, size } = useThree()

    // Render one frame at a fixed size, read it back as a data URL, then restore the canvas.
    // Reading right after render() works without preserveDrawingBuffer because it's the same task.
    const renderAt = useCallback(
        (width, height, type, quality, pixelRatio = gl.getPixelRatio()) => {
            const previousRatio = gl.getPixelRatio()
            gl.setPixelRatio(pixelRatio)
            camera.aspect = width / height
            camera.updateProjectionMatrix()
            gl.setSize(width, height)
            gl.render(scene, camera)
            const dataUrl = gl.domElement.toDataURL(type, quality)

            gl.setPixelRatio(previousRatio)
            camera.aspect = size.width / size.height
            camera.updateProjectionMatrix()
            gl.setSize(size.width, size.height)
            gl.render(scene, camera)
            return dataUrl
        },
        [gl, scene, camera, size]
    )

    // Screenshot button: download a 1280×720 PNG.
    const takeScreenshot = useCallback(() => {
        const link = document.createElement('a')
        link.download = 'svr-performance.png'
        link.href = renderAt(1280, 720, 'image/png')
        link.click()
    }, [renderAt])

    // Share: a small JPEG for the link preview. Pixel ratio 1 keeps it well under the 300 KB limit.
    const captureThumbnail = useCallback(
        async (event) => {
            const dataUrl = renderAt(600, 400, 'image/jpeg', 0.85, 1)
            event.detail.resolve(await (await fetch(dataUrl)).blob())
        },
        [renderAt]
    )

    useEffect(() => {
        window.addEventListener('takeScreenshot', takeScreenshot)
        window.addEventListener('captureThumbnail', captureThumbnail)
        return () => {
            window.removeEventListener('takeScreenshot', takeScreenshot)
            window.removeEventListener('captureThumbnail', captureThumbnail)
        }
    }, [takeScreenshot, captureThumbnail])

    return null
}
