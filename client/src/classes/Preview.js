import $ from 'jquery'
import Craft from 'craft'
import Emitter from './Emitter'
import { uniqueId } from '../utilities'

export default class Preview extends Emitter
{
	constructor()
	{
		super()

		const iframeId = uniqueId()

		this.$element = $(`
			<div class="embedded-assets_preview">
				<iframe id="${iframeId}" src="about:blank"></iframe>
			</div>
		`)

		this.$iframe = this.$element.find(`#${iframeId}`)

		this._setupHeightMonitor()
	}

	destroy()
	{
		this.$element.remove()
		this.$element = null

		if (this._$warningTrigger)
		{
			this._$warningTrigger.remove()
			this._$warningTrigger = null
		}

		if (this._warningHud)
		{
			this._warningHud.hide()
			this._warningHud.$hud.remove()
			this._warningHud.$shade.remove()
			this._warningHud = null
		}

		cancelAnimationFrame(this._heightMonitor)
		clearTimeout(this._requestTimeout)

		this.trigger('destroy')
	}

	setUrl(url, timeout)
	{
		this._request({ url }, timeout)
	}
	
	setAssetId(assetId, timeout)
	{
		this._request({ assetId }, timeout)
	}

	getWindow()
	{
		return this.$iframe[0].contentWindow
	}

	getDocument()
	{
		const previewWindow = this.getWindow()

		return previewWindow ? previewWindow.document : null
	}

	getBody()
	{
		const previewDocument = this.getDocument()

		return previewDocument ? previewDocument.body : null
	}

	getHeight()
	{
		return this._height
	}

	showWarning()
	{
		const $previewWindow = $(this.getWindow())
		const $previewDocument = $(this.getDocument())
		const $warning = $previewDocument.find('#warning')

		if ($warning.length > 0)
		{
			const { top: frameTop, left: frameLeft } = this.$iframe.offset()
			const frameScroll = $previewWindow.scrollTop()

			const { top: iconTop, left: iconLeft } = $warning.offset()

			const top = frameTop - frameScroll + iconTop
			const left = frameLeft + iconLeft
			const width = $warning.outerWidth()
			const height = $warning.outerHeight()

			if (!this._$warningTrigger)
			{
				this._$warningTrigger = $('<div>').css({
					position: 'absolute',
					display: 'none',
				})

				Garnish.$bod.append(this._$warningTrigger)
			}

			this._$warningTrigger.css({
				display: 'block',
				top: top + 'px',
				left: left + 'px',
				width: width + 'px',
				height: height + 'px',
			})

			if (!this._warningHud)
			{
				const untrustedSource = Craft.t('embeddedassets', "This information is coming from an untrusted source.")
				const securityMeasure = Craft.t('embeddedassets', "As a security measure embed codes will not be shown.")
				const $message = $(`
					<p><strong>${untrustedSource}</strong></p>
					<p>${securityMeasure}</p>
				`)

				this._warningHud = new Garnish.HUD(this._$warningTrigger, $message, {
					hudClass: 'hud info-hud',
					closeOtherHUDs: false,
					onHide: () => this._$warningTrigger.css('display', 'none'),
				})
			}
			else
			{
				this._warningHud.show()
			}
		}
	}
	
	_request(parameters, timeout = 15000)
	{
		const previewWindow = this.getWindow()

		if (previewWindow)
		{
			clearTimeout(this._requestTimeout)

			const showPreview = Boolean(parameters)
			let previewUrl = 'about:blank'

			if (showPreview)
			{
				parameters = Object.assign({ callback: uniqueId('embeddedassets') }, parameters)

				const complete = trigger =>
				{
					clearTimeout(this._requestTimeout)
					delete window[parameters.callback]
					this.trigger(trigger, parameters)
				}

				window[parameters.callback] = () =>
				{
					this._setupWarning()
					complete('load')
				}

				this._requestTimeout = setTimeout(() => complete('timeout'), timeout)

				previewUrl = Craft.getActionUrl('embeddedassets/actions/preview', parameters)
			}

			previewWindow.location.replace(previewUrl)
		}
	}

	_setupHeightMonitor()
	{
		this._height = 0

		const monitorHeight = () =>
		{
			const $previewBody = $(this.getBody())
			const height = $previewBody.height() || 0

			if (this._height !== height)
			{
				this.trigger('resize', { prevHeight: this._height, height })
				this._height = height
			}

			this._heightMonitor = requestAnimationFrame(monitorHeight)
		}

		monitorHeight()
	}

	_setupWarning()
	{
		const $previewDocument = $(this.getDocument())
		const $warning = $previewDocument.find('#warning')

		if ($warning.length > 0)
		{
			// Just in case
			$warning.off('.embeddedassets')
			$warning.on('click.embeddedassets', () => this.showWarning())
		}
	}
}